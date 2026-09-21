/**
 * Extraction corpus: clone pinned tags, extract in a subprocess with a hard
 * heap/time cap, optionally grade the spec against the TypeScript checker.
 *
 *   bun run test:corpus              # cheap: budget + min export count
 *   bun scripts/corpus-extract.ts --audit
 *   bun scripts/corpus-extract.ts --audit --rotate --check
 *   bun scripts/corpus-extract.ts --audit --write
 *   bun scripts/corpus-extract.ts --audit --file
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { extract } from '../packages/sdk/src/index.ts';
import {
  AXES,
  type Axis,
  type AuditResult,
  crashResult,
  ISSUE_TITLES,
  type Finding,
} from './corpus/oracle.ts';

type Pin = {
  name: string;
  repo: string;
  tag: string;
  entry: string;
  minExports: number;
  timeoutMs: number;
  only?: string[];
};

type PinsFile = { always: Pin[]; rotate: Pin[] };

type ChildOk = {
  exports: number;
  discovered: number;
  budget: number;
  audit?: AuditResult;
};

type PackageRow = {
  name: string;
  version: string;
  scores: Record<Axis, number>;
  overall: number;
  findingCounts: Record<string, number>;
  exports?: number;
  ms: number;
};

type Scoreboard = {
  generatedAt: string;
  totals: { overall: number; axes: Record<Axis, number> };
  packages: Record<string, PackageRow>;
  fingerprints: Record<string, { count: number; packages: string[] }>;
};

const repoRoot = path.resolve(import.meta.dir, '..');
const pinsPath = path.join(repoRoot, 'scripts/corpus/pins.json');
const scoreboardPath = path.join(repoRoot, 'scripts/corpus/scoreboard.json');
const findingsPath = path.join(repoRoot, 'scripts/corpus/findings.json');
const HEAP_MB = 2048;
const ROTATE_N = 4;
const ISSUE_CAP = 3;

const args = new Set(process.argv.slice(2));
const extractIdx = process.argv.indexOf('--extract');
const isExtractChild = extractIdx !== -1;
const wantAudit = args.has('--audit') || args.has('--write') || args.has('--check') || args.has('--file');
const wantWrite = args.has('--write');
const wantCheck = args.has('--check');
const wantFile = args.has('--file');
const wantRotate = args.has('--rotate');

if (isExtractChild) {
  const entryFile = process.argv[extractIdx + 1];
  if (!entryFile) {
    console.error('usage: corpus-extract --extract <entryFile> [--only a,b] [--audit]');
    process.exit(2);
  }
  const onlyArg = flagValue('--only');
  const only = onlyArg ? onlyArg.split(',').filter(Boolean) : undefined;
  const { spec, diagnostics, verification } = await extract({
    entryFile,
    ...(only ? { only } : {}),
  });
  const payload: ChildOk = {
    exports: spec.exports.length,
    discovered: verification?.discovered ?? spec.exports.length,
    budget: diagnostics.filter((d) => d.code === 'TYPE_EXPANSION_LIMIT').length,
  };
  if (wantAudit) {
    const { auditSpec } = await import('./corpus/oracle.ts');
    payload.audit = auditSpec({ spec, entryFile });
  }
  process.stdout.write(JSON.stringify(payload));
  process.exit(0);
}

function flagValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  if (i === -1) return undefined;
  const v = process.argv[i + 1];
  if (!v || v.startsWith('--')) return undefined;
  return v;
}

const pins = JSON.parse(fs.readFileSync(pinsPath, 'utf8')) as PinsFile;
const selected = [...pins.always];
if (wantRotate) {
  selected.push(...pickRotate(pins.rotate, ROTATE_N, new Date().toISOString().slice(0, 10)));
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'openpkg-corpus-'));
const clones = new Map<string, string>();
let failed = 0;
const rows: PackageRow[] = [];
const allFindings: Array<Finding & { package: string; version: string }> = [];

function cloneKey(p: Pin): string {
  return `${p.repo}#${p.tag}`;
}

function clonePin(p: Pin): string {
  const key = cloneKey(p);
  const existing = clones.get(key);
  if (existing) return existing;
  const dest = path.join(root, key.replace(/[^a-zA-Z0-9._-]+/g, '_'));
  const r = spawnSync(
    'git',
    ['clone', '--depth', '1', '--branch', p.tag, '--quiet', p.repo, dest],
    { stdio: 'inherit', env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } },
  );
  if (r.status !== 0) throw new Error(`clone failed: ${p.repo}@${p.tag}`);
  clones.set(key, dest);
  return dest;
}

function runExtract(p: Pin, entryFile: string): ChildOk & { ms: number } {
  const started = Date.now();
  const isBun = path.basename(process.execPath).includes('bun');
  const childArgs = isBun
    ? [`--max-heap-size=${HEAP_MB}`, import.meta.path, '--extract', entryFile]
    : [import.meta.path, '--extract', entryFile];
  if (p.only?.length) childArgs.push('--only', p.only.join(','));
  if (wantAudit) childArgs.push('--audit');
  const r = spawnSync(process.execPath, childArgs, {
    encoding: 'utf8',
    timeout: p.timeoutMs,
    maxBuffer: 20 * 1024 * 1024,
    env: { ...process.env, NODE_OPTIONS: `--max-old-space-size=${HEAP_MB}` },
  });
  const ms = Date.now() - started;
  if (r.error) throw new Error(r.error.message);
  if (r.signal) throw new Error(`killed by ${r.signal} after ${ms}ms`);
  if (r.status !== 0) {
    const err = (r.stderr || r.stdout || '').slice(-800);
    throw new Error(`exit ${r.status} after ${ms}ms${err ? `: ${err}` : ''}`);
  }
  const parsed = JSON.parse(r.stdout) as ChildOk;
  return { ...parsed, ms };
}

function cheapFail(p: Pin, result: ChildOk, ms: number): string | undefined {
  if (ms > p.timeoutMs) return `extract took ${ms}ms (budget ${p.timeoutMs})`;
  if (result.exports < p.minExports) return `${result.exports} exports (min ${p.minExports})`;
  // An `only` target asks for a few exports on purpose; coverage of the whole entry is not its job.
  if (p.only?.length) return undefined;
  const discovered = result.discovered;
  const tolerance = Math.max(5, Math.ceil(discovered * 0.15));
  if (discovered - result.exports > tolerance)
    return `extracted ${result.exports}/${discovered} exports (tolerance ${tolerance})`;
  return undefined;
}

for (const pin of selected) {
  const label = pin.name;
  try {
    const dest = clonePin(pin);
    const entryFile = path.join(dest, pin.entry);
    if (!fs.existsSync(entryFile)) {
      console.error(`FAIL ${label}: missing ${pin.entry}`);
      failed++;
      if (wantAudit) recordCrash(pin, `missing ${pin.entry}`, 0);
      continue;
    }
    const result = runExtract(pin, entryFile);
    const cheap = cheapFail(pin, result, result.ms);
    if (cheap) {
      console.error(`FAIL ${label}: ${cheap}`);
      failed++;
    } else {
      const budgetNote = result.budget ? ' (expansion budget hit)' : '';
      console.log(
        `ok ${label}: ${result.exports}/${result.discovered} exports in ${result.ms}ms${budgetNote}`,
      );
    }
    if (wantAudit) {
      const audit = result.audit ?? crashResult(cheap ?? 'audit missing from child');
      recordAudit(pin, audit, result);
    } else if (cheap) {
      continue;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`FAIL ${label}:`, msg);
    failed++;
    if (wantAudit) recordCrash(pin, msg, 0);
  }
}

function recordCrash(pin: Pin, reason: string, ms: number): void {
  const audit = crashResult(reason);
  recordAudit(pin, audit, { exports: 0, discovered: 0, budget: 0, ms });
}

function recordAudit(pin: Pin, audit: AuditResult, result: { exports: number; ms: number }): void {
  const findingCounts: Record<string, number> = {};
  for (const f of audit.findings) {
    findingCounts[f.fingerprint] = (findingCounts[f.fingerprint] ?? 0) + 1;
    allFindings.push({ ...f, package: pin.name, version: pin.tag });
  }
  rows.push({
    name: pin.name,
    version: pin.tag,
    scores: audit.scores,
    overall: audit.overall,
    findingCounts,
    exports: result.exports,
    ms: result.ms,
  });
}

function pickRotate(list: Pin[], n: number, seed: string): Pin[] {
  if (list.length <= n) return list;
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    h = (Math.imul(h, 1664525) + 1013904223) >>> 0;
    const j = h % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

function mean(xs: number[]): number {
  if (xs.length === 0) return 1;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function buildScoreboard(): Scoreboard {
  const axes = Object.fromEntries(
    AXES.map((a) => [a, mean(rows.map((r) => r.scores[a]))]),
  ) as Record<Axis, number>;
  const fingerprints: Scoreboard['fingerprints'] = {};
  for (const f of allFindings) {
    const slot = (fingerprints[f.fingerprint] ??= { count: 0, packages: [] });
    slot.count++;
    if (!slot.packages.includes(f.package)) slot.packages.push(f.package);
  }
  return {
    generatedAt: new Date().toISOString(),
    totals: { overall: mean(rows.map((r) => r.overall)), axes },
    packages: Object.fromEntries(rows.map((r) => [r.name, r])),
    fingerprints,
  };
}

function checkScoreboard(next: Scoreboard): string[] {
  if (!fs.existsSync(scoreboardPath)) return ['no committed scoreboard (run --write)'];
  const prev = JSON.parse(fs.readFileSync(scoreboardPath, 'utf8')) as Scoreboard;
  if (prev.generatedAt === 'seed' || Object.keys(prev.packages).length === 0) {
    return [];
  }
  const drops: string[] = [];
  const eps = 0.001;
  if (next.totals.overall + eps < prev.totals.overall)
    drops.push(`overall ${prev.totals.overall.toFixed(4)} → ${next.totals.overall.toFixed(4)}`);
  for (const axis of AXES) {
    if (next.totals.axes[axis] + eps < prev.totals.axes[axis])
      drops.push(`${axis} ${prev.totals.axes[axis].toFixed(4)} → ${next.totals.axes[axis].toFixed(4)}`);
  }
  for (const name of Object.keys(prev.packages)) {
    if (!next.packages[name]) drops.push(`missing package ${name}`);
  }
  return drops;
}

function issueBody(fingerprint: string, hits: Array<Finding & { package: string; version: string }>): string {
  const first = hits[0];
  const pkgs = [...new Set(hits.map((h) => `${h.package}@${h.version}`))];
  const title = ISSUE_TITLES[fingerprint] ?? fingerprint;
  return `<!-- ${fingerprint.startsWith('opk-audit:') ? fingerprint : `opk-audit:${fingerprint}`} -->

${title}

## Repro
\`\`\`ts
extract({ entryFile: '<entry>', only: ['${first.export ?? '*'}'] })
// ${first.package}@${first.version}
\`\`\`

- expected: ${first.expected}
- actual: ${first.actual}
${first.loc ? `- loc: ${first.loc}` : ''}

## Packages
${pkgs.map((p) => `- ${p}`).join('\n')}

## Fix
Add a fixture test for this construct. Scoreboard \`--check\` must not regress.
`;
}

function fileIssues(board: Scoreboard): void {
  const byFp = new Map<string, Array<Finding & { package: string; version: string }>>();
  for (const f of allFindings) {
    const list = byFp.get(f.fingerprint) ?? [];
    list.push(f);
    byFp.set(f.fingerprint, list);
  }
  const existing = spawnSync(
    'gh',
    ['issue', 'list', '--state', 'open', '--limit', '100', '--json', 'number,title,body'],
    { encoding: 'utf8' },
  );
  if (existing.status !== 0) {
    console.error('gh issue list failed:', existing.stderr);
    return;
  }
  const open = JSON.parse(existing.stdout || '[]') as Array<{ number: number; title: string; body: string }>;
  let created = 0;
  for (const [fp, hits] of byFp) {
    const token = `opk-audit:${fp}`;
    const match = open.find((i) => i.body?.includes(token) || i.body?.includes(`<!-- ${fp}`));
    const extra = hits
      .slice(0, 8)
      .map((h) => `- ${h.package}@${h.version} \`${h.export ?? ''}\`: ${h.actual}`)
      .join('\n');
    if (match) {
      spawnSync(
        'gh',
        ['issue', 'comment', String(match.number), '--body', `New occurrences of \`${fp}\`:\n${extra}`],
        { stdio: 'inherit' },
      );
      continue;
    }
    if (created >= ISSUE_CAP) continue;
    const title = `extract: ${ISSUE_TITLES[fp] ?? fp}`;
    const body = issueBody(fp, hits);
    const r = spawnSync('gh', ['issue', 'create', '--title', title, '--body', body], {
      encoding: 'utf8',
    });
    if (r.status === 0) {
      created++;
      console.log(`opened ${r.stdout.trim()}`);
    } else {
      console.error('gh issue create failed:', r.stderr);
    }
  }
}

fs.rmSync(root, { recursive: true, force: true });

if (wantAudit) {
  const board = buildScoreboard();
  fs.writeFileSync(findingsPath, `${JSON.stringify(allFindings, null, 2)}\n`);
  console.log(
    `audit overall ${board.totals.overall.toFixed(3)} across ${rows.length} packages, ${allFindings.length} findings`,
  );
  for (const [fp, info] of Object.entries(board.fingerprints)) {
    console.log(`  ${fp}: ${info.count} (${info.packages.join(', ')})`);
  }
  if (wantWrite) {
    fs.writeFileSync(scoreboardPath, `${JSON.stringify(board, null, 2)}\n`);
    console.log(`wrote ${scoreboardPath}`);
  }
  if (wantCheck) {
    const drops = checkScoreboard(board);
    if (drops.length > 0) {
      console.error(`scoreboard regression:\n${drops.map((d) => `  ${d}`).join('\n')}`);
      process.exit(1);
    }
    console.log('scoreboard check ok');
  }
  if (wantFile) fileIssues(board);
}

if (failed > 0) {
  console.error(`${failed} corpus target(s) failed`);
  process.exit(1);
}
console.log('corpus extract ok');
