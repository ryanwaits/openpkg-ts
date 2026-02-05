import { describe, expect, test } from 'bun:test';
import { extract } from '../builder/spec-builder';

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

    const signatures = fn?.signatures;
    expect(signatures).toHaveLength(1);

    const params = signatures[0].parameters;
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

    const signatures = fn?.signatures;
    const params = signatures[0].parameters;

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

    const signatures = fn?.signatures;
    const params = signatures[0].parameters;

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
    const signatures = fn?.signatures;
    const params = signatures[0].parameters;

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
    const signatures = fn?.signatures;
    const params = signatures[0].parameters;

    expect(params[0].name).toBe('a');
    expect(params[0].required).toBe(true);

    expect(params[1].name).toBe('b');
    expect(params[1].required).toBe(false);

    expect(params[2].name).toBe('c');
    expect(params[2].required).toBe(false);
  });
});
