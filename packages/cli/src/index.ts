#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import {
  calculateNextVersion,
  categorizeBreakingChanges,
  createDocs,
  diffSpecs,
  extractSpec,
  getAvailableVersions,
  getValidationErrors,
  listExports,
  recommendSemverBump,
  type SchemaVersion,
} from '@openpkg-ts/sdk';

/** Minimal shape we read off a parsed spec file. */
type ParsedSpec = { openpkg?: string; meta?: { version?: string } };

const HELP = `openpkg - extract TypeScript API specs and generate docs

Usage:
  openpkg spec <entry.ts> [-o spec.json]
  openpkg docs <entry.ts | spec.json> [-f md|html|json] [-o out]
  openpkg list <entry.ts> [--json]
  openpkg validate <spec.json>
  openpkg diff <old.json> <new.json> [--json]

Commands:
  spec      Extract an OpenPkg spec from a TypeScript entry point
  docs      Generate docs from an entry point or an existing spec file
  list      List exports (name, kind, location)
  validate  Validate a spec file against the OpenPkg meta-schema
  diff      Compare two spec files and recommend a semver bump

Options:
  -o, --output   Write to file instead of stdout
  -f, --format   docs output format: md (default), html, json
      --json     list/diff output as JSON
  -h, --help     Show this help
  -v, --version  Show version
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

async function specCommand(args: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    options: { output: { type: 'string', short: 'o' } },
    allowPositionals: true,
  });
  const entryFile = positionals[0];
  if (!entryFile) fail('spec requires an entry file (openpkg spec src/index.ts)');

  const { spec, diagnostics } = await extractSpec({ entryFile });
  reportDiagnostics(diagnostics);
  write(JSON.stringify(spec, null, 2), values.output);
}

async function docsCommand(args: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    options: {
      output: { type: 'string', short: 'o' },
      format: { type: 'string', short: 'f' },
    },
    allowPositionals: true,
  });
  const input = positionals[0];
  if (!input) fail('docs requires an entry file or spec file (openpkg docs src/index.ts)');
  const format = values.format ?? 'md';
  if (!['md', 'html', 'json'].includes(format)) fail(`unknown format "${format}" (md|html|json)`);

  let docs: ReturnType<typeof createDocs>;
  if (input.endsWith('.json')) {
    docs = createDocs(input);
  } else {
    const { spec, diagnostics } = await extractSpec({ entryFile: input });
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
    options: { json: { type: 'boolean' } },
    allowPositionals: true,
  });
  const entryFile = positionals[0];
  if (!entryFile) fail('list requires an entry file (openpkg list src/index.ts)');

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
