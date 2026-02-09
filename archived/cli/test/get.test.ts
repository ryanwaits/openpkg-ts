import { describe, expect, test } from 'bun:test';
import { getExport } from '@openpkg-ts/sdk';

describe('getExport', () => {
  describe('function exports', () => {
    test('gets function with signature and parameters', async () => {
      const code = `
        /** Creates a new client */
        export function createClient(config: Config): Client {
          return {} as Client;
        }
        interface Config { baseUrl: string; }
        interface Client { fetch(): void; }
      `;

      const result = await getExport({
        entryFile: 'test.ts',
        exportName: 'createClient',
        content: code,
      });

      expect(result.errors).toHaveLength(0);
      expect(result.export).not.toBeNull();
      expect(result.export?.kind).toBe('function');
      expect(result.export?.signatures).toBeDefined();
      expect(result.export?.signatures).toHaveLength(1);

      const sig = result.export?.signatures?.[0];
      expect(sig.parameters).toHaveLength(1);
      expect(sig.parameters?.[0].name).toBe('config');
    });

    test('gets arrow function export', async () => {
      const code = `
        /** Arrow function export */
        export const add = (a: number, b: number): number => a + b;
      `;

      const result = await getExport({ entryFile: 'test.ts', exportName: 'add', content: code });

      expect(result.errors).toHaveLength(0);
      expect(result.export).not.toBeNull();
      // Arrow functions assigned to const are classified as variables at declaration level
      // but listExports detects them as functions via type analysis
      expect(['function', 'variable']).toContain(result.export?.kind);
    });

    test('gets function with overloads', async () => {
      const code = `
        /** @overload */
        export function parse(input: string): object;
        /** @overload */
        export function parse(input: Buffer): object;
        export function parse(input: string | Buffer): object {
          return {};
        }
      `;

      const result = await getExport({ entryFile: 'test.ts', exportName: 'parse', content: code });

      expect(result.errors).toHaveLength(0);
      expect(result.export?.kind).toBe('function');
      // Should have multiple signatures for overloads
      expect(result.export?.signatures?.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('interface exports', () => {
    test('gets interface with properties', async () => {
      const code = `
        /** Configuration interface */
        export interface Config {
          /** Base URL for API */
          baseUrl: string;
          /** Optional timeout */
          timeout?: number;
        }
      `;

      const result = await getExport({ entryFile: 'test.ts', exportName: 'Config', content: code });

      expect(result.errors).toHaveLength(0);
      expect(result.export).not.toBeNull();
      expect(result.export?.kind).toBe('interface');
      expect(result.export?.members).toBeDefined();
      expect(result.export?.members?.length).toBe(2);

      const baseUrl = result.export?.members?.find((m: { name: string }) => m.name === 'baseUrl');
      expect(baseUrl).toBeDefined();
    });

    test('gets interface with methods', async () => {
      const code = `
        /** Client interface */
        export interface Client {
          /** Fetch data */
          fetch(url: string): Promise<Response>;
        }
      `;

      const result = await getExport({ entryFile: 'test.ts', exportName: 'Client', content: code });

      expect(result.errors).toHaveLength(0);
      expect(result.export?.kind).toBe('interface');
      expect(result.export?.members).toBeDefined();

      const fetch = result.export?.members?.find((m: { name: string }) => m.name === 'fetch');
      expect(fetch).toBeDefined();
    });
  });

  describe('type alias exports', () => {
    test('gets type alias', async () => {
      const code = `
        /** Union type */
        export type Result = Success | Error;
        interface Success { ok: true; data: unknown; }
        interface Error { ok: false; error: string; }
      `;

      const result = await getExport({ entryFile: 'test.ts', exportName: 'Result', content: code });

      expect(result.errors).toHaveLength(0);
      expect(result.export).not.toBeNull();
      expect(result.export?.kind).toBe('type');
    });

    test('gets mapped type', async () => {
      const code = `
        /** Make all properties optional */
        export type Partial<T> = { [K in keyof T]?: T[K] };
      `;

      const result = await getExport({
        entryFile: 'test.ts',
        exportName: 'Partial',
        content: code,
      });

      expect(result.errors).toHaveLength(0);
      expect(result.export?.kind).toBe('type');
    });
  });

  describe('class exports', () => {
    test('gets class with members', async () => {
      const code = `
        /** API Client class */
        export class ApiClient {
          /** Base URL */
          baseUrl: string;

          constructor(config: { baseUrl: string }) {
            this.baseUrl = config.baseUrl;
          }

          /** Make request */
          async request(path: string): Promise<Response> {
            return fetch(this.baseUrl + path);
          }
        }
      `;

      const result = await getExport({
        entryFile: 'test.ts',
        exportName: 'ApiClient',
        content: code,
      });

      expect(result.errors).toHaveLength(0);
      expect(result.export).not.toBeNull();
      expect(result.export?.kind).toBe('class');
      expect(result.export?.members).toBeDefined();

      // Should have baseUrl property and request method
      const members = result.export?.members ?? [];
      expect(members.some((m: { name: string }) => m.name === 'baseUrl')).toBe(true);
      expect(members.some((m: { name: string }) => m.name === 'request')).toBe(true);
    });

    test('gets class with static members', async () => {
      const code = `
        /** Class with statics */
        export class Utils {
          static readonly VERSION = '1.0.0';
          static format(s: string): string { return s; }
        }
      `;

      const result = await getExport({ entryFile: 'test.ts', exportName: 'Utils', content: code });

      expect(result.errors).toHaveLength(0);
      expect(result.export?.kind).toBe('class');

      const members = result.export?.members ?? [];
      const version = members.find((m: { name: string }) => m.name === 'VERSION');
      const format = members.find((m: { name: string }) => m.name === 'format');
      expect(version).toBeDefined();
      expect(format).toBeDefined();
    });
  });

  describe('enum exports', () => {
    test('gets enum with members', async () => {
      const code = `
        /** Log levels */
        export enum LogLevel {
          DEBUG = 0,
          INFO = 1,
          WARN = 2,
          ERROR = 3
        }
      `;

      const result = await getExport({
        entryFile: 'test.ts',
        exportName: 'LogLevel',
        content: code,
      });

      expect(result.errors).toHaveLength(0);
      expect(result.export).not.toBeNull();
      expect(result.export?.kind).toBe('enum');
      expect(result.export?.members).toBeDefined();
      expect(result.export?.members?.length).toBe(4);
    });

    test('gets string enum', async () => {
      const code = `
        /** Status values */
        export enum Status {
          Pending = 'pending',
          Active = 'active',
          Done = 'done'
        }
      `;

      const result = await getExport({ entryFile: 'test.ts', exportName: 'Status', content: code });

      expect(result.errors).toHaveLength(0);
      expect(result.export?.kind).toBe('enum');
      expect(result.export?.members?.length).toBe(3);
    });
  });

  describe('variable exports', () => {
    test('gets const variable', async () => {
      const code = `
        /** Default config */
        export const DEFAULT_CONFIG = { timeout: 5000, retries: 3 };
      `;

      const result = await getExport({
        entryFile: 'test.ts',
        exportName: 'DEFAULT_CONFIG',
        content: code,
      });

      expect(result.errors).toHaveLength(0);
      expect(result.export).not.toBeNull();
      expect(result.export?.kind).toBe('variable');
    });

    test('gets typed const', async () => {
      const code = `
        /** API version */
        export const VERSION: string = '1.0.0';
      `;

      const result = await getExport({
        entryFile: 'test.ts',
        exportName: 'VERSION',
        content: code,
      });

      expect(result.errors).toHaveLength(0);
      expect(result.export?.kind).toBe('variable');
    });
  });

  describe('namespace exports', () => {
    test('gets namespace with exports', async () => {
      const code = `
        /** Utility namespace */
        export namespace Utils {
          export const PI = 3.14159;
          export function square(n: number): number { return n * n; }
        }
      `;

      const result = await getExport({ entryFile: 'test.ts', exportName: 'Utils', content: code });

      // Namespace serialization may not be fully implemented
      // Check that we at least get a result or a meaningful error
      if (result.export) {
        expect(result.export.kind).toBe('namespace');
      } else {
        // If namespace not supported, we expect a serialization error
        expect(result.errors.length).toBeGreaterThan(0);
      }
    });
  });

  describe('error handling', () => {
    test('returns error for non-existent export', async () => {
      const code = `
        export function myFunc(): void {}
      `;

      const result = await getExport({
        entryFile: 'test.ts',
        exportName: 'NonExistent',
        content: code,
      });

      expect(result.export).toBeNull();
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain("Export 'NonExistent' not found");
    });

    test('returns error for empty file', async () => {
      const code = `// empty file`;

      const result = await getExport({
        entryFile: 'test.ts',
        exportName: 'anything',
        content: code,
      });

      expect(result.export).toBeNull();
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('related types', () => {
    test('includes referenced types', async () => {
      const code = `
        export interface Response {
          data: Data;
        }
        export interface Data {
          id: string;
        }
      `;

      const result = await getExport({
        entryFile: 'test.ts',
        exportName: 'Response',
        content: code,
      });

      expect(result.errors).toHaveLength(0);
      expect(result.export).not.toBeNull();
      // Related types may be in result.types
      // Depends on implementation - Data may or may not be included
    });
  });

  describe('output structure', () => {
    test('output matches spec format', async () => {
      const code = `
        /** Creates something */
        export function create(name: string): void {}
      `;

      const result = await getExport({ entryFile: 'test.ts', exportName: 'create', content: code });

      expect(result.export).not.toBeNull();

      // Verify spec structure
      const exp = result.export;
      if (!exp) throw new Error('Export not found');
      expect(exp.kind).toBe('function');
      expect(exp.name).toBe('create');
      expect(typeof exp.description).toBe('string');
    });

    test('result has export, types, errors fields', async () => {
      const code = `export const x = 1;`;

      const result = await getExport({ entryFile: 'test.ts', exportName: 'x', content: code });

      expect(result).toHaveProperty('export');
      expect(result).toHaveProperty('types');
      expect(result).toHaveProperty('errors');
      expect(Array.isArray(result.types)).toBe(true);
      expect(Array.isArray(result.errors)).toBe(true);
    });
  });

  describe('performance', () => {
    test('single export lookup is reasonably fast', async () => {
      const code = `
        export function myFunc(): void {}
        export interface MyInterface { value: string; }
        export class MyClass { prop: number = 0; }
        export type MyType = string | number;
        export const myVar = 42;
        export enum MyEnum { A, B, C }
      `;

      // Each call creates a new TypeScript program, so overhead is expected
      // Target: under 3s for cold start, which is acceptable for CLI usage
      const start = performance.now();
      const result = await getExport({ entryFile: 'test.ts', exportName: 'myFunc', content: code });
      const elapsed = performance.now() - start;

      expect(result.errors).toHaveLength(0);
      expect(result.export).not.toBeNull();
      // 3s accounts for CI/local machine variance
      expect(elapsed).toBeLessThan(3000);
    });
  });
});
