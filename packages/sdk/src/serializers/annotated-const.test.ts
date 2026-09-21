import { describe, expect, test } from 'bun:test';
import type { SpecExport, SpecSignatureParameter } from '@openpkg-ts/spec';
import { extract } from '../builder/spec-builder';

async function exportOf(code: string, name: string): Promise<SpecExport | undefined> {
  const result = await extract({ entryFile: 'test.ts', content: code });
  return result.spec.exports.find((e) => e.name === name);
}

function params(fn: SpecExport | undefined, sig = 0): SpecSignatureParameter[] {
  return fn?.signatures?.[sig]?.parameters ?? [];
}

describe('annotated const with function initializer', () => {
  test('written function type wins over a rest-args initializer', async () => {
    const fn = await exportOf(
      `export interface Params { truthy?: string[] }
       export const stringbool: (_params?: string | Params) => boolean = (...args) => args.length > 0 as any;`,
      'stringbool',
    );

    expect(fn?.kind).toBe('function');
    expect(fn?.signatures).toHaveLength(1);
    const [p] = params(fn);
    expect(params(fn)).toHaveLength(1);
    expect(p.name).toBe('_params');
    expect(p.required).toBe(false);
    expect(p.rest).toBeUndefined();
    expect(fn?.signatures?.[0].returns?.schema).toEqual({ type: 'boolean' });
  });

  test('written interface with overloads wins over the initializer', async () => {
    const fn = await exportOf(
      `export interface Fmt {
         /** Format a number. */
         (n: number): string;
         (s: string, pad?: number): string;
       }
       export const fmt: Fmt = function (...args: any[]) { return String(args[0]); };`,
      'fmt',
    );

    expect(fn?.kind).toBe('function');
    expect(fn?.signatures).toHaveLength(2);
    expect(params(fn, 0).map((p) => p.name)).toEqual(['n']);
    expect(params(fn, 1).map((p) => [p.name, p.required])).toEqual([
      ['s', true],
      ['pad', false],
    ]);
    expect(fn?.signatures?.[0].description).toBe('Format a number.');
  });

  test('keeps the statement docs and async flag of the initializer', async () => {
    const fn = await exportOf(
      `/** Load it. */
       export const load: (id: string) => Promise<number> = async (...a) => 1;`,
      'load',
    );

    expect(fn?.description).toBe('Load it.');
    expect(fn?.flags?.async).toBe(true);
    expect(params(fn).map((p) => p.name)).toEqual(['id']);
  });

  test('generic written function type carries its type parameters', async () => {
    const fn = await exportOf(
      `export const first: <T extends object>(items: T[]) => T = (...a: any[]) => a[0][0];`,
      'first',
    );

    expect(fn?.typeParameters).toEqual([{ name: 'T', constraint: 'object' }]);
    expect(fn?.signatures?.[0].typeParameters).toEqual([{ name: 'T', constraint: 'object' }]);
    expect(params(fn).map((p) => p.name)).toEqual(['items']);
  });

  test('non-callable annotation still reads the initializer', async () => {
    const fn = await exportOf(`export const f: unknown = (a: number) => a;`, 'f');

    expect(fn?.kind).toBe('function');
    expect(params(fn).map((p) => p.name)).toEqual(['a']);
  });
});

describe('rest parameters', () => {
  test('function declaration rest param is rest and not required', async () => {
    const fn = await exportOf(
      `export function join(sep: string, ...parts: string[]): string { return parts.join(sep); }`,
      'join',
    );

    const [sep, parts] = params(fn);
    expect(sep.required).toBe(true);
    expect(sep.rest).toBeUndefined();
    expect(parts.name).toBe('parts');
    expect(parts.rest).toBe(true);
    expect(parts.required).toBe(false);
    expect(parts.schema).toEqual({ type: 'array', items: { type: 'string' } });
  });

  test('arrow, method and function-typed property rest params', async () => {
    const result = await extract({
      entryFile: 'test.ts',
      content: `export const sum = (...n: number[]) => 0;
        export class Log { write(...lines: string[]): void {} }
        export interface Api { call: (...args: unknown[]) => void; run(...args: string[]): void }`,
    });
    const byName = (n: string) => result.spec.exports.find((e) => e.name === n);

    expect(params(byName('sum'))[0]).toMatchObject({ name: 'n', rest: true, required: false });

    const write = byName('Log')?.members?.find((m) => m.name === 'write');
    expect(write?.signatures?.[0].parameters?.[0]).toMatchObject({
      name: 'lines',
      rest: true,
      required: false,
    });

    for (const name of ['call', 'run']) {
      const member = byName('Api')?.members?.find((m) => m.name === name);
      const sigs =
        member?.signatures ??
        ((member?.schema as Record<string, unknown>)?.[
          'x-ts-signatures'
        ] as SpecExport['signatures']);
      expect(sigs?.[0].parameters?.[0]).toMatchObject({ rest: true, required: false });
    }
  });
});
