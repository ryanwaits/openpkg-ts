/**
 * Union-order audit: extracts known corpora with the current (TS5 JS-API) backend
 * and records every ordered union occurrence (`anyOf` arrays, `enum` arrays,
 * `x-ts-type` strings containing ` | `), deduplicated into unique ordered
 * sequences with occurrence counts.
 *
 * TS7 mandates deterministic "stable type ordering" — union member order in
 * checker output (and therefore in typeToString / anyOf arrays) can differ from
 * TS5. This report is the baseline: when a TypeScript upgrade or backend change
 * reorders any union, `--check` fails and the diff shows exactly which
 * sequences changed.
 *
 * Usage:
 *   bun scripts/union-order-audit.ts --write   # regenerate scripts/union-order-audit.json
 *   bun scripts/union-order-audit.ts --check   # exit 1 if current extraction differs from the checked-in report
 *
 * NOTE: this script intentionally imports the deprecated `extract` export
 * (packages/sdk/src/index.ts marks it "Legacy export (deprecated - use
 * extractSpec instead)"). If `extract` is ever removed from the sdk, port this
 * script to `extractSpec`.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import ts from 'typescript';
import { extract } from '../packages/sdk/src/index.ts';

const repoRoot = resolve(import.meta.dir, '..');
const reportPath = join(repoRoot, 'scripts', 'union-order-audit.json');

/** Extraction corpora, repo-relative. sdk self-extraction is the rich one (~3k unions). */
const targets = [
  'packages/sdk/src/index.ts',
  'packages/cli/test-fixtures/sample.ts',
  'packages/sdk/src/compiler/fixtures/barrel-reexport/index.ts',
  'packages/sdk/src/compiler/fixtures/unresolved-deps/index.ts',
];

/** JSON.stringify with recursively sorted object keys (deterministic hashing). */
const stableStringify = (v: unknown): string =>
  JSON.stringify(v, (_k, val) =>
    val && typeof val === 'object' && !Array.isArray(val)
      ? Object.fromEntries(Object.entries(val).sort(([a], [b]) => a.localeCompare(b)))
      : val,
  );

/** Compact, human-readable fingerprint for one union member schema. */
const fingerprint = (m: unknown): string => {
  if (m && typeof m === 'object' && !Array.isArray(m)) {
    const o = m as Record<string, unknown>;
    if (typeof o.$ref === 'string') return o.$ref;
    if (typeof o['x-ts-type'] === 'string') return `ts:${o['x-ts-type']}`;
    if (typeof o.type === 'string' && Object.keys(o).length === 1) return o.type;
  }
  return `h:${createHash('sha256').update(stableStringify(m)).digest('hex').slice(0, 10)}`;
};

interface Report {
  generatedWith: string;
  targets: string[];
  totals: { anyOf: number; enum: number; 'x-ts-type': number };
  uniqueUnions: Array<{ union: string; count: number }>;
}

async function buildReport(): Promise<Report> {
  const totals = { anyOf: 0, enum: 0, 'x-ts-type': 0 };
  const seq = new Map<string, number>();
  const record = (key: string) => seq.set(key, (seq.get(key) ?? 0) + 1);
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const v of node) walk(v);
      return;
    }
    if (node && typeof node === 'object') {
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
        if (k === 'anyOf' && Array.isArray(v) && v.length >= 2) {
          totals.anyOf++;
          record(`anyOf ${v.map(fingerprint).join(' , ')}`);
        }
        if (k === 'enum' && Array.isArray(v) && v.length >= 2) {
          totals.enum++;
          record(`enum ${JSON.stringify(v)}`);
        }
        if (k === 'x-ts-type' && typeof v === 'string' && v.includes(' | ')) {
          totals['x-ts-type']++;
          record(`x-ts-type ${v}`);
        }
        walk(v);
      }
    }
  };
  for (const target of targets) {
    const result = await extract({ entryFile: join(repoRoot, target) });
    walk(result.spec);
  }
  return {
    generatedWith: `typescript ${ts.version}`,
    targets,
    totals,
    uniqueUnions: [...seq.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([union, count]) => ({ union, count })),
  };
}

const mode = process.argv[2];
if (mode !== '--write' && mode !== '--check') {
  console.error('Usage: bun scripts/union-order-audit.ts --write | --check');
  process.exit(2);
}

const report = await buildReport();
const serialized = `${JSON.stringify(report, null, 2)}\n`;

if (mode === '--write') {
  writeFileSync(reportPath, serialized);
  console.log(
    `wrote ${reportPath}: ${report.uniqueUnions.length} unique unions ` +
      `(anyOf=${report.totals.anyOf} enum=${report.totals.enum} x-ts-type=${report.totals['x-ts-type']})`,
  );
} else {
  const previous = JSON.parse(readFileSync(reportPath, 'utf8')) as Report;
  const prevMap = new Map(previous.uniqueUnions.map((u) => [u.union, u.count]));
  const currMap = new Map(report.uniqueUnions.map((u) => [u.union, u.count]));
  const added = [...currMap.keys()].filter((k) => !prevMap.has(k));
  const removed = [...prevMap.keys()].filter((k) => !currMap.has(k));
  const changed = [...currMap.entries()].filter(([k, n]) => prevMap.has(k) && prevMap.get(k) !== n);
  if (added.length === 0 && removed.length === 0 && changed.length === 0) {
    console.log(
      `union-order check OK: ${report.uniqueUnions.length} unique unions match the baseline`,
    );
    process.exit(0);
  }
  console.error(
    `UNION ORDER DRIFT vs baseline (generated with ${previous.generatedWith}, now ${report.generatedWith})`,
  );
  for (const k of removed) console.error(`  - removed: ${k}`);
  for (const k of added) console.error(`  + added:   ${k}`);
  for (const [k, n] of changed) console.error(`  ~ count:   ${k} (${prevMap.get(k)} -> ${n})`);
  console.error(
    'If intentional (TS upgrade / backend change), regenerate: bun scripts/union-order-audit.ts --write',
  );
  process.exit(1);
}
