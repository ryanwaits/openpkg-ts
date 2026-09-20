/**
 * Extraction corpus: shallow-clone popular TS packages and assert extract()
 * finishes within a time/memory budget with most of the entry's exports kept.
 *
 *   bun run test:corpus
 *
 * Always run under a heap cap so a runaway is a failed target, not an OOM'd machine.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { extract } from '../packages/sdk/src/index.ts';

type Target = {
  repo: string;
  name: string;
  entry: string;
  minExports: number;
  timeoutMs: number;
};

const TARGETS: Target[] = [
  { repo: 'https://github.com/pmndrs/zustand', name: 'zustand', entry: 'src/index.ts', minExports: 5, timeoutMs: 60_000 },
  { repo: 'https://github.com/pmndrs/jotai', name: 'jotai', entry: 'src/index.ts', minExports: 5, timeoutMs: 60_000 },
  { repo: 'https://github.com/pmndrs/valtio', name: 'valtio', entry: 'src/index.ts', minExports: 3, timeoutMs: 60_000 },
  { repo: 'https://github.com/immerjs/immer', name: 'immer', entry: 'src/immer.ts', minExports: 15, timeoutMs: 60_000 },
  { repo: 'https://github.com/fabian-hiller/valibot', name: 'valibot', entry: 'library/src/index.ts', minExports: 50, timeoutMs: 90_000 },
  { repo: 'https://github.com/colinhacks/zod', name: 'zod', entry: 'packages/zod/src/index.ts', minExports: 10, timeoutMs: 90_000 },
  { repo: 'https://github.com/honojs/hono', name: 'hono', entry: 'src/index.ts', minExports: 10, timeoutMs: 90_000 },
];

if (process.argv[2] === '--extract') {
  const entryFile = process.argv[3];
  if (!entryFile) {
    console.error('usage: corpus-extract --extract <entryFile>');
    process.exit(2);
  }
  const { spec, diagnostics, verification } = await extract({ entryFile });
  process.stdout.write(
    JSON.stringify({
      exports: spec.exports.length,
      discovered: verification?.discovered ?? spec.exports.length,
      budget: diagnostics.filter((d) => d.code === 'TYPE_EXPANSION_LIMIT').length,
    }),
  );
  process.exit(0);
}

const HEAP_MB = 2048;
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'openpkg-corpus-'));
let failed = 0;

function clone(target: Target): string {
  const dest = path.join(root, target.name);
  const r = spawnSync('git', ['clone', '--depth', '1', '--quiet', target.repo, dest], {
    stdio: 'inherit',
  });
  if (r.status !== 0) throw new Error(`clone failed: ${target.repo}`);
  return dest;
}

function runExtract(entryFile: string, timeoutMs: number): {
  exports: number;
  discovered: number;
  budget: number;
  ms: number;
} {
  const started = Date.now();
  const isBun = path.basename(process.execPath).includes('bun');
  const args = isBun
    ? [`--max-heap-size=${HEAP_MB}`, import.meta.path, '--extract', entryFile]
    : [import.meta.path, '--extract', entryFile];
  const r = spawnSync(process.execPath, args, {
    encoding: 'utf8',
    timeout: timeoutMs,
    maxBuffer: 10 * 1024 * 1024,
    env: { ...process.env, NODE_OPTIONS: `--max-old-space-size=${HEAP_MB}` },
  });
  const ms = Date.now() - started;
  if (r.error) {
    throw new Error(r.error.message);
  }
  if (r.signal) {
    throw new Error(`killed by ${r.signal} after ${ms}ms`);
  }
  if (r.status !== 0) {
    const err = (r.stderr || r.stdout || '').slice(-500);
    throw new Error(`exit ${r.status} after ${ms}ms${err ? `: ${err}` : ''}`);
  }
  const parsed = JSON.parse(r.stdout) as { exports: number; discovered: number; budget: number };
  return { ...parsed, ms };
}

for (const target of TARGETS) {
  const label = target.name;
  try {
    const dest = clone(target);
    const entryFile = path.join(dest, target.entry);
    if (!fs.existsSync(entryFile)) {
      console.error(`FAIL ${label}: missing ${target.entry}`);
      failed++;
      continue;
    }
    const { exports: count, discovered, budget, ms } = runExtract(entryFile, target.timeoutMs);
    if (ms > target.timeoutMs) {
      console.error(`FAIL ${label}: extract took ${ms}ms (budget ${target.timeoutMs})`);
      failed++;
      continue;
    }
    const tolerance = Math.max(5, Math.ceil(discovered * 0.15));
    if (count < target.minExports) {
      console.error(`FAIL ${label}: ${count} exports (min ${target.minExports})`);
      failed++;
      continue;
    }
    if (discovered - count > tolerance) {
      console.error(
        `FAIL ${label}: extracted ${count}/${discovered} exports (tolerance ${tolerance})`,
      );
      failed++;
      continue;
    }
    console.log(
      `ok ${label}: ${count}/${discovered} exports in ${ms}ms` +
        (budget ? ` (expansion budget hit)` : ''),
    );
  } catch (err) {
    console.error(`FAIL ${label}:`, err instanceof Error ? err.message : err);
    failed++;
  }
}

fs.rmSync(root, { recursive: true, force: true });
if (failed > 0) {
  console.error(`${failed} corpus target(s) failed`);
  process.exit(1);
}
console.log('corpus extract ok');
