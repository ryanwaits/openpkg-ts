import { describe, expect, test } from 'bun:test';
import type { SpecExport, SpecSignatureParameter } from '@openpkg-ts/spec';
import { extract } from '../builder/spec-builder';

/** Narrow to the first signature's parameters, failing the test if missing. */
function firstSignatureParams(fn: SpecExport | undefined): SpecSignatureParameter[] {
  const params = fn?.signatures?.[0]?.parameters;
  if (!params) throw new Error('expected export to have a signature with parameters');
  return params;
}

describe('optional parameter detection', () => {
  test('marks optional param with ? as required: false', async () => {
    const code = `export function test(a: string, b?: number) {}`;

    const result = await extract({
      entryFile: 'test.ts',
      content: code,
    });

    const fn = result.spec.exports.find((e) => e.name === 'test');
    expect(fn).toBeDefined();
    expect(fn?.kind).toBe('function');

    expect(fn?.signatures).toHaveLength(1);

    const params = firstSignatureParams(fn);
    expect(params).toHaveLength(2);

    expect(params[0].name).toBe('a');
    expect(params[0].required).toBe(true);

    expect(params[1].name).toBe('b');
    expect(params[1].required).toBe(false);
  });

  test('marks param with default value as required: false', async () => {
    const code = `export function test(a: string, b = 10) {}`;

    const result = await extract({
      entryFile: 'test.ts',
      content: code,
    });

    const fn = result.spec.exports.find((e) => e.name === 'test');
    expect(fn).toBeDefined();

    const params = firstSignatureParams(fn);

    expect(params[0].name).toBe('a');
    expect(params[0].required).toBe(true);

    expect(params[1].name).toBe('b');
    expect(params[1].required).toBe(false);
  });

  test('marks required param as required: true', async () => {
    const code = `export function test(a: string) {}`;

    const result = await extract({
      entryFile: 'test.ts',
      content: code,
    });

    const fn = result.spec.exports.find((e) => e.name === 'test');
    expect(fn).toBeDefined();

    const params = firstSignatureParams(fn);

    expect(params).toHaveLength(1);
    expect(params[0].name).toBe('a');
    expect(params[0].required).toBe(true);
  });

  test('handles multiple optional params', async () => {
    const code = `export function test(a: string, b?: number, c?: boolean) {}`;

    const result = await extract({
      entryFile: 'test.ts',
      content: code,
    });

    const fn = result.spec.exports.find((e) => e.name === 'test');
    const params = firstSignatureParams(fn);

    expect(params[0].required).toBe(true);
    expect(params[1].required).toBe(false);
    expect(params[2].required).toBe(false);
  });

  test('handles mix of default and ? optional params', async () => {
    const code = `export function test(a: string, b?: number, c = 'default') {}`;

    const result = await extract({
      entryFile: 'test.ts',
      content: code,
    });

    const fn = result.spec.exports.find((e) => e.name === 'test');
    const params = firstSignatureParams(fn);

    expect(params[0].name).toBe('a');
    expect(params[0].required).toBe(true);

    expect(params[1].name).toBe('b');
    expect(params[1].required).toBe(false);

    expect(params[2].name).toBe('c');
    expect(params[2].required).toBe(false);
  });
});

describe('parameter defaults', () => {
  test('literal initializers become default values', async () => {
    const code = `export function search(query: string, limit = 10, label = 'all', deep = false, offset = -1, empty = null) {}`;
    const result = await extract({ entryFile: 'test.ts', content: code });
    const fn = result.spec.exports.find((e) => e.name === 'search');
    const params = firstSignatureParams(fn);

    expect(params[1]).toMatchObject({ name: 'limit', required: false, default: 10 });
    expect(params[2]).toMatchObject({ name: 'label', required: false, default: 'all' });
    expect(params[3]).toMatchObject({ name: 'deep', required: false, default: false });
    expect(params[4]).toMatchObject({ name: 'offset', required: false, default: -1 });
    expect(params[5]).toMatchObject({ name: 'empty', required: false, default: null });
    expect((params[1].schema as Record<string, unknown>).default).toBe(10);
  });

  test('non-literal initializers become x-ts-default text, never default', async () => {
    const code = `const DEFAULT_LIMIT = 25;
export function search(query: string, limit = DEFAULT_LIMIT) {}`;
    const result = await extract({ entryFile: 'test.ts', content: code });
    const fn = result.spec.exports.find((e) => e.name === 'search');
    const params = firstSignatureParams(fn);

    expect(params[1].default).toBeUndefined();
    expect((params[1].schema as Record<string, unknown>)['x-ts-default']).toBe('DEFAULT_LIMIT');
  });

  test('destructured non-literal initializers stop leaking text into default', async () => {
    const code = `const FALLBACK = 'x';
export function run({ mode = FALLBACK, retries = 3 }: { mode?: string; retries?: number }) {}`;
    const result = await extract({ entryFile: 'test.ts', content: code });
    const fn = result.spec.exports.find((e) => e.name === 'run');
    const params = firstSignatureParams(fn);

    const mode = params.find((p) => p.name === 'mode');
    const retries = params.find((p) => p.name === 'retries');
    expect(mode?.default).toBeUndefined();
    expect((mode?.schema as Record<string, unknown>)['x-ts-default']).toBe('FALLBACK');
    expect(retries?.default).toBe(3);
  });
});
