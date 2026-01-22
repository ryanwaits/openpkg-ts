import { describe, expect, test } from 'bun:test';
import { extract } from '../builder/spec-builder';

describe('arrow function exports', () => {
  test('arrow function const has kind: function', async () => {
    const code = `export const add = (a: number, b: number) => a + b;`;

    const result = await extract({
      entryFile: 'test.ts',
      content: code,
    });

    const fn = result.spec.exports.find((e) => e.name === 'add');
    expect(fn).toBeDefined();
    expect(fn?.kind).toBe('function');
    expect((fn as any).signatures).toBeDefined();
    expect((fn as any).signatures).toHaveLength(1);
  });

  test('arrow function optional params marked correctly', async () => {
    const code = `export const greet = (name: string, greeting?: string) => greeting ? \`\${greeting} \${name}\` : \`Hello \${name}\`;`;

    const result = await extract({
      entryFile: 'test.ts',
      content: code,
    });

    const fn = result.spec.exports.find((e) => e.name === 'greet');
    expect(fn).toBeDefined();
    expect(fn?.kind).toBe('function');

    const signatures = (fn as any).signatures;
    const params = signatures[0].parameters;

    expect(params[0].name).toBe('name');
    expect(params[0].required).toBe(true);

    expect(params[1].name).toBe('greeting');
    expect(params[1].required).toBe(false);
  });

  test('arrow function with default param marked optional', async () => {
    const code = `export const multiply = (a: number, b = 2) => a * b;`;

    const result = await extract({
      entryFile: 'test.ts',
      content: code,
    });

    const fn = result.spec.exports.find((e) => e.name === 'multiply');
    expect(fn?.kind).toBe('function');

    const signatures = (fn as any).signatures;
    const params = signatures[0].parameters;

    expect(params[0].required).toBe(true);
    expect(params[1].required).toBe(false);
  });

  test('non-function const remains kind: variable', async () => {
    const code = `export const config = { port: 3000, host: 'localhost' };`;

    const result = await extract({
      entryFile: 'test.ts',
      content: code,
    });

    const variable = result.spec.exports.find((e) => e.name === 'config');
    expect(variable).toBeDefined();
    expect(variable?.kind).toBe('variable');
  });

  test('primitive const remains kind: variable', async () => {
    const code = `export const MAX_SIZE = 100;`;

    const result = await extract({
      entryFile: 'test.ts',
      content: code,
    });

    const variable = result.spec.exports.find((e) => e.name === 'MAX_SIZE');
    expect(variable).toBeDefined();
    expect(variable?.kind).toBe('variable');
  });

  test('arrow function preserves return type', async () => {
    const code = `export const double = (n: number): number => n * 2;`;

    const result = await extract({
      entryFile: 'test.ts',
      content: code,
    });

    const fn = result.spec.exports.find((e) => e.name === 'double');
    expect(fn?.kind).toBe('function');

    const signatures = (fn as any).signatures;
    const returnSchema = signatures[0].returns.schema;
    expect(returnSchema.type).toBe('number');
  });
});
