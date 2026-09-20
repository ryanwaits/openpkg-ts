import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { extract } from './spec-builder';

/**
 * Named re-exports through an `export *` barrel (immer: `export { original }
 * from "./internal"` where internal is `export * from "./core/current"`).
 */
describe('named re-exports through export * barrels', () => {
  let dir: string;
  let entry: string;

  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'openpkg-star-reexport-'));
    fs.writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify({ name: 'pkg', type: 'module' }),
    );
    fs.mkdirSync(path.join(dir, 'core'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'types'), { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'core/current.ts'),
      '/** Get the current value. */\nexport function original<T>(value: T): T { return value; }\nexport function freeze<T>(v: T): T { return v; }\n',
    );
    fs.writeFileSync(
      path.join(dir, 'types/types-external.ts'),
      [
        'export interface IProduce {',
        '  <T>(base: T, recipe: (draft: T) => void): T;',
        '  <T>(recipe: (draft: T) => void): (base: T) => T;',
        '}',
        'export type Draft<T> = T;',
        'export interface Patch { op: string; path: (string | number)[] }',
      ].join('\n'),
    );
    fs.writeFileSync(
      path.join(dir, 'internal.ts'),
      'export * from "./core/current";\nexport * from "./types/types-external";\n',
    );
    entry = path.join(dir, 'index.ts');
    fs.writeFileSync(
      entry,
      [
        'import type { IProduce } from "./internal";',
        'export { Draft, Patch, original, freeze as frozen } from "./internal";',
        'const impl = <T>(base: T, _recipe: (draft: T) => void): T => base;',
        '/** Produce a next state. */',
        'export const produce: IProduce = impl;',
      ].join('\n'),
    );
  });

  afterAll(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('named re-exports and `as` renames through an export * barrel are kept', async () => {
    const { spec, verification } = await extract({ entryFile: entry });
    const names = spec.exports.map((e) => e.name).sort();
    expect(names).toContain('original');
    expect(names).toContain('frozen');
    expect(names).toContain('Draft');
    expect(names).toContain('Patch');
    expect(names).toContain('produce');
    expect(names).not.toContain('freeze');
    const skipped = verification?.details.skipped ?? [];
    expect(skipped.map((s) => s.name)).not.toContain('original');
  });

  test('const typed by an in-package callable interface exposes overloads', async () => {
    const { spec } = await extract({ entryFile: entry });
    const produce = spec.exports.find((e) => e.name === 'produce');
    expect(produce).toBeDefined();
    expect(produce?.signatures?.length).toBeGreaterThanOrEqual(2);

    const iproduce =
      spec.types?.find((t) => t.name === 'IProduce') ??
      spec.exports.find((e) => e.name === 'IProduce');
    expect(iproduce?.kind).not.toBe('external');
    expect((iproduce as { external?: boolean } | undefined)?.external).not.toBe(true);
  });
});
