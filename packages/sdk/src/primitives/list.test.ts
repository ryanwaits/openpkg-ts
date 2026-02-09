import { describe, expect, test } from 'bun:test';
import { listExports } from './list';

describe('listExports', () => {
  test('lists all 7 export kinds', async () => {
    const code = `
      /** A function */
      export function myFunc(): void {}

      /** A class */
      export class MyClass {}

      /** An interface */
      export interface MyInterface { value: string; }

      /** A type alias */
      export type MyType = string | number;

      /** A variable */
      export const myVar = 42;

      /** An enum */
      export enum MyEnum { A, B }

      /** A namespace */
      export namespace MyNamespace { export const x = 1; }
    `;

    const result = await listExports({ entryFile: 'test.ts', content: code });

    expect(result.errors).toHaveLength(0);
    expect(result.exports).toHaveLength(7);

    const kinds = result.exports.map((e) => e.kind).sort();
    expect(kinds).toEqual([
      'class',
      'enum',
      'function',
      'interface',
      'namespace',
      'type',
      'variable',
    ]);
  });

  test('detects arrow function as function', async () => {
    const code = `
      /** Arrow fn */
      export const arrowFn = () => {};
    `;

    const result = await listExports({ entryFile: 'test.ts', content: code });

    expect(result.exports).toHaveLength(1);
    expect(result.exports[0].kind).toBe('function');
  });

  test('extracts descriptions', async () => {
    const code = `
      /** This is the description */
      export function myFunc(): void {}
    `;

    const result = await listExports({ entryFile: 'test.ts', content: code });

    expect(result.exports[0].description).toBe('This is the description');
  });

  test('truncates descriptions at 80 chars', async () => {
    const longDesc = 'A'.repeat(100);
    const code = `
      /** ${longDesc} */
      export function myFunc(): void {}
    `;

    const result = await listExports({ entryFile: 'test.ts', content: code });

    expect(result.exports[0].description?.length).toBe(80);
    expect(result.exports[0].description).toEndWith('...');
  });

  test('detects deprecated exports', async () => {
    const code = `
      /** @deprecated Use newFunc */
      export function oldFunc(): void {}
    `;

    const result = await listExports({ entryFile: 'test.ts', content: code });

    expect(result.exports[0].deprecated).toBe(true);
  });

  test('detects re-exports', async () => {
    const code = `
      export { existsSync } from 'node:fs';
    `;

    const result = await listExports({ entryFile: 'test.ts', content: code });

    expect(result.exports[0].reexport).toBe(true);
  });

  test('provides line numbers (1-indexed)', async () => {
    const code = `export function myFunc(): void {}`;

    const result = await listExports({ entryFile: 'test.ts', content: code });

    expect(result.exports[0].line).toBe(1);
  });

  test('sorts exports by name', async () => {
    const code = `
      export const zebra = 1;
      export const alpha = 2;
      export const mike = 3;
    `;

    const result = await listExports({ entryFile: 'test.ts', content: code });

    const names = result.exports.map((e) => e.name);
    expect(names).toEqual(['alpha', 'mike', 'zebra']);
  });

  test('function expression assigned to const gets kind=function', async () => {
    const code = `
      /** A handler */
      export const handler = function(req: string): string { return req; };
    `;

    const result = await listExports({ entryFile: 'test.ts', content: code });

    expect(result.exports).toHaveLength(1);
    expect(result.exports[0].kind).toBe('function');
  });

  test('aliased exports use export name, not original name', async () => {
    const code = `
      const internalFunc = () => {};
      export { internalFunc as publicApi };
    `;

    const result = await listExports({ entryFile: 'test.ts', content: code });

    expect(result.exports[0].name).toBe('publicApi');
  });
});
