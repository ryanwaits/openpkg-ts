import { describe, expect, test } from 'bun:test';
import { getExport } from './get';

describe('getExport', () => {
  test('gets a function export', async () => {
    const code = `
      /** Add two numbers */
      export function add(a: number, b: number): number { return a + b; }
    `;
    const result = await getExport({ entryFile: 'test.ts', exportName: 'add', content: code });
    expect(result.export).not.toBeNull();
    expect(result.export!.kind).toBe('function');
    expect(result.export!.name).toBe('add');
  });

  test('gets a namespace export (export * as X)', async () => {
    const code = `
      export * as Utils from 'node:path';
    `;
    const result = await getExport({ entryFile: 'test.ts', exportName: 'Utils', content: code });
    expect(result.errors).toHaveLength(0);
    expect(result.export).not.toBeNull();
    expect(result.export!.kind).toBe('namespace');
    expect(result.export!.name).toBe('Utils');
  });

  test('gets a namespace from module declaration', async () => {
    const code = `
      export namespace Config {
        export const debug = false;
        export function reset(): void {}
      }
    `;
    const result = await getExport({ entryFile: 'test.ts', exportName: 'Config', content: code });
    expect(result.export).not.toBeNull();
    expect(result.export!.kind).toBe('namespace');
    expect(result.export!.name).toBe('Config');
  });

  test('aliased re-export uses export name for both id and name', async () => {
    const code = `
      function internalName(): void {}
      export { internalName as publicApi };
    `;
    const result = await getExport({ entryFile: 'test.ts', exportName: 'publicApi', content: code });
    expect(result.export).not.toBeNull();
    expect(result.export!.id).toBe('publicApi');
    expect(result.export!.name).toBe('publicApi');
  });

  test('string literal union type schema does not expand to String prototype', async () => {
    const code = `
      export type Status = 'active' | 'inactive' | 'pending';
      export function getStatus(): Status { return 'active'; }
    `;
    const result = await getExport({ entryFile: 'test.ts', exportName: 'getStatus', content: code });
    expect(result.export).not.toBeNull();
    // The Status type in types[] should be {type: "string", enum: [...]} not String prototype
    const statusType = result.types.find(t => t.name === 'Status');
    if (statusType) {
      const schema = statusType.schema as Record<string, unknown>;
      expect(schema.type).toBe('string');
      expect(schema.enum).toEqual(['active', 'inactive', 'pending']);
      // Should NOT have String prototype methods
      expect(schema).not.toHaveProperty('properties');
    }
  });

  test('enum type schema does not expand to Number prototype', async () => {
    const code = `
      export enum Priority { Low = 0, Medium = 1, High = 2 }
      export function getPriority(): Priority { return Priority.Medium; }
    `;
    const result = await getExport({ entryFile: 'test.ts', exportName: 'getPriority', content: code });
    expect(result.export).not.toBeNull();
    const priorityType = result.types.find(t => t.name === 'Priority');
    if (priorityType) {
      const schema = priorityType.schema as Record<string, unknown>;
      // Should have enum values, not Number prototype methods like toFixed
      expect(schema).not.toHaveProperty('properties');
    }
  });

  test('gets interface with method members', async () => {
    const code = `
      interface Base<T> {}
      export interface NumericType<T extends Base<any> = Base<any>> extends Base<T> {
        gte(value: number): this;
        min(value: number): this;
        gt(value: number): this;
      }
    `;
    const result = await getExport({ entryFile: 'test.ts', exportName: 'NumericType', content: code });
    expect(result.export).not.toBeNull();
    expect(result.export!.kind).toBe('interface');
    expect(result.export!.name).toBe('NumericType');
  });

  test('const with function type annotation gets kind=function', async () => {
    const code = `
      function impl(data: string): number { return 0; }
      export const parse: (data: string) => number = impl;
    `;
    const result = await getExport({ entryFile: 'test.ts', exportName: 'parse', content: code });
    expect(result.export).not.toBeNull();
    expect(result.export!.kind).toBe('function');
  });

  test('function expression assigned to const gets kind=function', async () => {
    const code = `
      /** A handler */
      export const handler = function(req: string): string { return req; };
    `;
    const result = await getExport({ entryFile: 'test.ts', exportName: 'handler', content: code });
    expect(result.export).not.toBeNull();
    expect(result.export!.kind).toBe('function');
  });
});
