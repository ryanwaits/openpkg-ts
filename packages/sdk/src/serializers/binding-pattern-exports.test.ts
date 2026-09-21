import { afterEach, describe, expect, test } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { SpecExport } from '@openpkg-ts/spec';
import { extract } from '../builder/spec-builder';

function write(file: string, content: string) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

async function exportsOf(code: string): Promise<Map<string, SpecExport>> {
  const result = await extract({ entryFile: 'test.ts', content: code });
  return new Map(result.spec.exports.map((e) => [e.name, e]));
}

describe('exports bound by destructuring', () => {
  let tmp: string;

  afterEach(() => {
    if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
  });

  /** swr's shape: tuple destructure with holes, exported by name, re-exported through two barrels. */
  test('array pattern bindings survive barrel re-exports with checker types', async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'openpkg-binding-'));
    write(path.join(tmp, 'package.json'), JSON.stringify({ name: 'pkg' }));
    write(
      path.join(tmp, 'tsconfig.json'),
      JSON.stringify({ compilerOptions: { module: 'ESNext', strict: true } }),
    );
    write(
      path.join(tmp, 'src/internal/config.ts'),
      `export interface Cache<T> { get(key: string): T | undefined }
       export interface ScopedMutator {
         /** Mutate by key. */
         (key: string, data?: unknown): Promise<void>;
         (matcher: (key: string) => boolean): Promise<void[]>;
       }
       declare function initCache(m: Map<string, unknown>): unknown;
       const [cache, mutate, , , unload] = initCache(new Map()) as [
         Cache<any>, ScopedMutator, () => void, () => void, () => void
       ];
       export { cache, mutate, unload };`,
    );
    write(path.join(tmp, 'src/internal/index.ts'), `export * from "./config";`);
    const entryFile = path.join(tmp, 'src/index.ts');
    write(
      entryFile,
      `export { mutate } from "./internal";\nexport { unload } from "./internal";\nexport { cache as defaultCache } from "./internal";`,
    );

    const result = await extract({ entryFile });
    const byName = new Map(result.spec.exports.map((e) => [e.name, e]));

    const mutate = byName.get('mutate');
    expect(mutate?.kind).toBe('function');
    expect(mutate?.signatures).toHaveLength(2);
    expect(mutate?.signatures?.[0].parameters?.map((p) => p.name)).toEqual(['key', 'data']);
    expect(mutate?.signatures?.[0].description).toBe('Mutate by key.');
    expect(mutate?.source?.file).toContain('config.ts');

    const unload = byName.get('unload');
    expect(unload?.kind).toBe('function');
    expect(unload?.signatures?.[0].parameters ?? []).toEqual([]);

    const cache = byName.get('defaultCache');
    expect(cache?.kind).toBe('variable');
    expect(cache?.schema).toMatchObject({ $ref: '#/types/Cache' });

    expect(result.verification?.details.skipped ?? []).toEqual([]);
  });

  test('object pattern: renames, defaults, nesting and rest', async () => {
    const byName = await exportsOf(
      `declare const source: {
         port: number;
         host?: string;
         nested: { deep: boolean };
         run(cmd: string): number;
         extra: string;
       };
       export const { port, host: hostname = "localhost", nested: { deep }, run, ...others } = source;`,
    );

    expect([...byName.keys()].sort()).toEqual(['deep', 'hostname', 'others', 'port', 'run']);
    expect(byName.get('port')).toMatchObject({ kind: 'variable', schema: { type: 'number' } });
    expect(byName.get('hostname')).toMatchObject({ kind: 'variable', schema: { type: 'string' } });
    expect(byName.get('deep')).toMatchObject({ kind: 'variable', schema: { type: 'boolean' } });
    expect(byName.get('run')?.kind).toBe('function');
    expect(byName.get('run')?.signatures?.[0].parameters?.[0]).toMatchObject({ name: 'cmd' });
    expect(byName.get('others')?.kind).toBe('variable');
  });

  test('a bound constructor is a class', async () => {
    const byName = await exportsOf(
      `class Impl { go(): void {} }
       const pair = [Impl, 1] as [typeof Impl, number];
       export const [Ctor, count] = pair;`,
    );

    expect(byName.get('Ctor')?.kind).toBe('class');
    expect(byName.get('count')).toMatchObject({ kind: 'variable', schema: { type: 'number' } });
  });
});
