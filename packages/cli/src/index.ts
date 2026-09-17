#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { parseArgs } from 'node:util';
import {
  calculateNextVersion,
  categorizeBreakingChanges,
  createDocs,
  diffSpecs,
  extractSpec,
  getAvailableVersions,
  getValidationErrors,
  isRemoteInput,
  listExports,
  loadConfig,
  mergeConfig,
  type OpenpkgConfig,
  type PackageRecord,
  pickEntry,
  recommendSemverBump,
  resolveTarget,
  type SchemaVersion,
} from '@openpkg-ts/sdk';

/** Minimal shape we read off a parsed spec file. */
type ParsedSpec = { openpkg?: string; meta?: { version?: string } };

const HELP = `openpkg - extract TypeScript API specs and generate docs

Usage:
  openpkg spec [path | entry.ts] [intent...] [-o spec.json] [--follow-external <pkg,...>]
  openpkg docs [path | entry.ts | spec.json] [intent...] [-f md|html|json] [-o out]
  openpkg list [path | entry.ts] [intent...] [--json]
  openpkg validate <spec.json>
  openpkg diff <old.json> <new.json> [--json]

Commands:
  spec      Extract an OpenPkg spec (dir, cwd, or entry file)
  docs      Generate docs from a package, entry point, or spec file
  list      List exports (name, kind, location)
  validate  Validate a spec file against the OpenPkg meta-schema
  diff      Compare two spec files and recommend a semver bump

Options:
  -o, --output            Write to file instead of stdout
  -f, --format            docs output format: md (default), html, json
      --json              list/diff output as JSON
      --follow-external   Expand types from these packages (comma-separated,
                          globs ok: "@ai-sdk/*"). Default: stub externals.
      --follow-external-all   Expand every external package (use with care)
      --only              Only extract these exports (comma-separated, * ok)
      --ignore            Ignore these exports (comma-separated, * ok)
      --jev               Route package/entry with Jev (needs AI_GATEWAY_API_KEY)
  -h, --help              Show this help
  -v, --version           Show version

Config: reads openpkg.config.json (or package.json "openpkg" field) from the
cwd. Flags override the file. Example openpkg.config.json:
  { "followExternal": ["@acme/payment-kit", "@ai-sdk/*"] }
`;

function fail(message: string): never {
  console.error(`error: ${message}`);
  process.exit(1);
}

function write(content: string, output?: string): void {
  if (output) {
    fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
    fs.writeFileSync(output, content);
    console.error(`wrote ${output}`);
  } else {
    console.log(content);
  }
}

function version(): string {
  const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf-8')) as {
    version: string;
  };
  return pkg.version;
}

function reportDiagnostics(diagnostics: Array<{ severity: string; message: string }>): void {
  for (const d of diagnostics) {
    if (d.severity === 'error' || d.severity === 'warning') {
      console.error(`${d.severity}: ${d.message}`);
    }
  }
  if (diagnostics.some((d) => d.severity === 'error')) {
    process.exit(1);
  }
}

function parseTargetArgs(positionals: string[], cwd: string): { input: string; intent?: string } {
  if (!positionals.length) return { input: cwd };
  const first = positionals[0];
  const rest = positionals.slice(1).join(' ').trim();
  const abs = path.resolve(cwd, first);
  if (isRemoteInput(first)) {
    return { input: first, ...(rest ? { intent: rest } : {}) };
  }
  if (fs.existsSync(abs)) {
    return { input: abs, ...(rest ? { intent: rest } : {}) };
  }
  return { input: cwd, intent: positionals.join(' ') };
}

function formatPackages(candidates: PackageRecord[], cwd: string): string {
  return candidates
    .map((c, i) => {
      const rel = path.relative(cwd, c.dir) || '.';
      return `  ${i + 1}. ${c.name}  ${rel}`;
    })
    .join('\n');
}

async function choosePackage(candidates: PackageRecord[], cwd: string): Promise<PackageRecord> {
  const body = `multiple packages — pick one:\n${formatPackages(candidates, cwd)}`;
  if (!process.stdin.isTTY || !process.stderr.isTTY) {
    const hint = candidates[0]?.name.split('/').pop() ?? 'sdk';
    fail(`${body}\nre-run with a path or intent, e.g. openpkg spec . ${hint}`);
  }
  console.error(body);
  const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
  try {
    const answer = await rl.question(`Package [1-${candidates.length}]: `);
    const i = Number(answer.trim());
    if (!Number.isInteger(i) || i < 1 || i > candidates.length) fail('invalid selection');
    return candidates[i - 1];
  } finally {
    rl.close();
  }
}

function loadCwdEnv() {
  for (const name of ['.env.local', '.env']) {
    const file = path.join(process.cwd(), name);
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const i = t.indexOf('=');
      if (i === -1) continue;
      const k = t.slice(0, i).trim();
      const v = t.slice(i + 1).trim();
      if (k && process.env[k] === undefined) process.env[k] = v;
    }
  }
}

async function resolveCliTarget(positionals: string[], decisions?: 'heuristic' | 'jev') {
  loadCwdEnv();
  const cwd = process.cwd();
  const { input, intent } = parseTargetArgs(positionals, cwd);
  const resolved = await resolveTarget({ input, intent, cwd, decisions });
  if (resolved.kind === 'unavailable') fail(resolved.reason);
  if (resolved.kind === 'remote') fail('failed to clone remote repo');
  if (resolved.kind === 'empty') fail(resolved.reason);
  if (resolved.kind === 'needs-build') {
    console.error(`error: ${resolved.reason}`);
    if (resolved.command) console.error(`  → ${resolved.command}`);
    process.exit(2);
  }
  if (resolved.kind === 'explicit') {
    return { entryFile: resolved.entryFile, entryPointSource: resolved.entryPointSource };
  }
  if (resolved.kind === 'ok') {
    return { entryFile: resolved.entryFile, entryPointSource: resolved.entryPointSource };
  }
  const chosen = await choosePackage(resolved.candidates, cwd);
  const picked = pickEntry(chosen.dir);
  if (!picked) fail(`no TypeScript entry found in ${chosen.name}`);
  return picked;
}

function toList(value: string | undefined): string[] | undefined {
  if (!value) return undefined;
  const items = value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return items.length > 0 ? items : undefined;
}

/** Print the external packages that were stubbed, with the exact names to
 * follow — so users never have to guess the declaring package. */
function reportStubbedExternals(spec: { types?: Array<Record<string, unknown>> }): void {
  const counts = new Map<string, number>();
  for (const t of spec.types ?? []) {
    if (!t.external) continue;
    const pkg = (t.schema as Record<string, unknown> | undefined)?.['x-ts-package'];
    const key = typeof pkg === 'string' ? pkg : '(unknown origin)';
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  if (counts.size === 0) return;
  const summary = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([pkg, n]) => `${pkg} (${n})`)
    .join(', ');
  console.error(`external types stubbed from: ${summary}`);
  console.error(
    '  → add package names to followExternal (config or --follow-external) to expand them',
  );
}

async function specCommand(args: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    options: {
      output: { type: 'string', short: 'o' },
      'follow-external': { type: 'string' },
      'follow-external-all': { type: 'boolean' },
      only: { type: 'string' },
      ignore: { type: 'string' },
      jev: { type: 'boolean' },
    },
    allowPositionals: true,
  });

  const fileConfig = loadConfig(process.cwd());
  const cliConfig: Partial<OpenpkgConfig> = {
    followExternal: values['follow-external-all']
      ? true
      : toList(values['follow-external'] as string | undefined),
    only: toList(values.only as string | undefined),
    ignore: toList(values.ignore as string | undefined),
    ...(values.jev ? { decisions: 'jev' as const } : {}),
  };
  const { entryFile, entryPointSource } = await resolveCliTarget(
    positionals,
    cliConfig.decisions ?? fileConfig?.decisions,
  );
  const config = mergeConfig(fileConfig, cliConfig);

  const { spec, diagnostics } = await extractSpec({
    entryFile,
    entryPointSource,
    followExternal: config.followExternal,
    only: config.only,
    ignore: config.ignore,
    externals: config.externals,
  });
  reportDiagnostics(diagnostics);
  if (!config.followExternal) reportStubbedExternals(spec);
  write(JSON.stringify(spec, null, 2), values.output);
}

async function docsCommand(args: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    options: {
      output: { type: 'string', short: 'o' },
      format: { type: 'string', short: 'f' },
      jev: { type: 'boolean' },
    },
    allowPositionals: true,
  });
  const format = values.format ?? 'md';
  if (!['md', 'html', 'json'].includes(format)) fail(`unknown format "${format}" (md|html|json)`);

  let docs: ReturnType<typeof createDocs>;
  if (positionals[0]?.endsWith('.json')) {
    docs = createDocs(positionals[0]);
  } else {
    const decisions = values.jev ? 'jev' : loadConfig(process.cwd())?.decisions;
    const { entryFile, entryPointSource } = await resolveCliTarget(positionals, decisions);
    const { spec, diagnostics } = await extractSpec({ entryFile, entryPointSource });
    reportDiagnostics(diagnostics);
    docs = createDocs(spec);
  }

  const content =
    format === 'md'
      ? docs.toMarkdown()
      : format === 'html'
        ? docs.toHTML()
        : JSON.stringify(docs.toJSON(), null, 2);
  write(content, values.output);
}

async function listCommand(args: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    options: { json: { type: 'boolean' }, jev: { type: 'boolean' } },
    allowPositionals: true,
  });
  const decisions = values.jev ? 'jev' : loadConfig(process.cwd())?.decisions;
  const { entryFile } = await resolveCliTarget(positionals, decisions);

  const { exports, errors } = await listExports({ entryFile });
  for (const err of errors) {
    console.error(`error: ${err}`);
  }
  if (errors.length > 0 && exports.length === 0) {
    process.exit(1);
  }
  if (values.json) {
    console.log(JSON.stringify(exports, null, 2));
    return;
  }
  for (const exp of exports) {
    const location = exp.file ? ` (${exp.file}:${exp.line})` : '';
    console.log(`${exp.kind.padEnd(10)}${exp.name}${location}`);
  }
}

function readSpecFile(file: string): ReturnType<typeof JSON.parse> {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch (err) {
    fail(`failed to read spec file ${file}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/** Validate against the spec's declared version when known, else 'latest'. */
function pickVersion(spec: unknown): SchemaVersion {
  const declared = (spec as ParsedSpec)?.openpkg;
  if (typeof declared === 'string' && getAvailableVersions().includes(declared)) {
    return declared as SchemaVersion;
  }
  return 'latest';
}

/** Parse a spec file and reject it if it doesn't validate against the meta-schema. */
function readValidSpecFile(file: string): ReturnType<typeof JSON.parse> {
  const parsed = readSpecFile(file);
  const errors = getValidationErrors(parsed, pickVersion(parsed));
  if (errors.length > 0) {
    const details = errors.map((e) => `  ${e.instancePath || '/'} ${e.message}`).join('\n');
    fail(`invalid spec ${file}:\n${details}`);
  }
  return parsed;
}

function validateCommand(args: string[]): void {
  const [file] = args;
  if (!file) fail('validate requires a spec file (openpkg validate spec.json)');

  const spec = readSpecFile(file);
  const errors = getValidationErrors(spec, pickVersion(spec));
  if (errors.length === 0) {
    console.log(`${file}: valid`);
    return;
  }
  for (const e of errors) {
    console.error(`${e.instancePath || '/'} ${e.message}`);
  }
  process.exit(1);
}

function diffCommand(args: string[]): void {
  const { values, positionals } = parseArgs({
    args,
    options: { json: { type: 'boolean' } },
    allowPositionals: true,
  });
  const [oldFile, newFile] = positionals;
  if (!oldFile || !newFile) fail('diff requires two spec files (openpkg diff old.json new.json)');

  const oldSpec = readValidSpecFile(oldFile);
  const newSpec = readValidSpecFile(newFile);
  const diff = diffSpecs(oldSpec, newSpec);
  const recommendation = recommendSemverBump(diff);
  const oldVersion = (newSpec as ParsedSpec)?.meta?.version;
  const nextVersion = oldVersion
    ? calculateNextVersion(oldVersion, recommendation.bump)
    : undefined;

  if (values.json) {
    console.log(
      JSON.stringify(
        {
          breaking: diff.breaking,
          nonBreaking: diff.nonBreaking,
          docsOnly: diff.docsOnly,
          categorized: categorizeBreakingChanges(diff.breaking, oldSpec, newSpec),
          recommendation,
          ...(nextVersion ? { nextVersion } : {}),
        },
        null,
        2,
      ),
    );
    if (diff.breaking.length) process.exitCode = 2;
    return;
  }

  const section = (title: string, items: string[]) => {
    if (!items.length) return;
    console.log(`${title}:`);
    for (const item of items) console.log(`  - ${item}`);
  };
  section('Breaking', diff.breaking);
  section('Non-breaking', diff.nonBreaking);
  section('Docs-only', diff.docsOnly);
  if (!diff.breaking.length && !diff.nonBreaking.length && !diff.docsOnly.length) {
    console.log('No changes.');
  }
  console.log(`\nRecommended bump: ${recommendation.bump} (${recommendation.reason})`);
  if (nextVersion) console.log(`Next version: ${nextVersion}`);
  if (diff.breaking.length) process.exitCode = 2;
}

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);

  switch (command) {
    case 'spec':
      await specCommand(rest);
      break;
    case 'docs':
      await docsCommand(rest);
      break;
    case 'list':
      await listCommand(rest);
      break;
    case 'validate':
      validateCommand(rest);
      break;
    case 'diff':
      diffCommand(rest);
      break;
    case '-v':
    case '--version':
      console.log(version());
      break;
    case undefined:
    case '-h':
    case '--help':
      console.log(HELP);
      break;
    default:
      fail(`unknown command "${command}" - run openpkg --help`);
  }
}

main().catch((err: unknown) => {
  fail(err instanceof Error ? err.message : String(err));
});
