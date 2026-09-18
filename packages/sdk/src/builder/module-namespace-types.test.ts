import { afterAll, beforeAll, expect, test } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { extract } from './spec-builder';

/**
 * `export * as Cl from './cl'` gives the namespace a source-file module
 * symbol whose TS name is the quoted absolute path. It must never land in
 * types[]: the spec would leak a local path and differ per machine.
 * Found on @stacks/transactions.
 */

let dir: string;

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'openpkg-modns-'));
  fs.writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify({ name: 'modns', version: '1.0.0' }),
  );
  fs.writeFileSync(
    path.join(dir, 'cl.ts'),
    [
      'export function int(value: bigint): { type: "int" } { return { type: "int" }; }',
      'export function bool(value: boolean): boolean { return value; }',
    ].join('\n'),
  );
  fs.writeFileSync(
    path.join(dir, 'index.ts'),
    "/** Clarity value builders */\nexport * as Cl from './cl';\n",
  );
});

afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

test('module namespace symbols are not registered as path-named types', async () => {
  const { spec } = await extract({ entryFile: path.join(dir, 'index.ts') });
  expect(spec.exports.some((e) => e.name === 'Cl')).toBe(true);
  expect((spec.types ?? []).filter((t) => t.name.startsWith('"'))).toEqual([]);
});
