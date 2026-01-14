import { describe, expect, test, beforeAll, afterAll } from 'bun:test';
import { extractSpec, type ExtractOptions, type ExtractResult } from '@openpkg-ts/sdk';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

// Test fixture code samples
const FIXTURE_CODE = {
  basic: `
    /** Creates a new client */
    export function createClient(config: Config): Client {
      return {} as Client;
    }
    /** Configuration interface */
    export interface Config {
      baseUrl: string;
      timeout?: number;
    }
    interface Client { fetch(): void; }
    /** API version */
    export const VERSION = '1.0.0';
  `,
  withClasses: `
    /** Base class */
    export class Service {
      name: string = 'service';
      start(): void {}
    }
    /** Helper type */
    export type ServiceConfig = { enabled: boolean };
  `,
  withEnums: `
    /** Log levels */
    export enum LogLevel {
      DEBUG = 0,
      INFO = 1,
      ERROR = 2
    }
    /** Status values */
    export enum Status {
      Pending = 'pending',
      Done = 'done'
    }
  `,
  forFiltering: `
    export function createUser() {}
    export function createPost() {}
    export function deleteUser() {}
    export const MAX_USERS = 100;
    export interface User { id: string }
  `,
  empty: `// empty file`,
  syntaxError: `export function broken( { syntax }`,
};

describe('spec command (extractSpec)', () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openpkg-spec-test-'));
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('valid spec generation', () => {
    test('generates spec with exports', async () => {
      const result = await extractSpec({
        entryFile: 'test.ts',
        content: FIXTURE_CODE.basic,
      });

      expect(result.spec).toBeDefined();
      expect(result.spec.openpkg).toBeDefined();
      expect(result.spec.exports.length).toBeGreaterThan(0);
      expect(result.diagnostics).toBeInstanceOf(Array);
    });

    test('includes meta information', async () => {
      const result = await extractSpec({
        entryFile: 'mypackage/index.ts',
        content: FIXTURE_CODE.basic,
      });

      expect(result.spec.meta).toBeDefined();
    });

    test('extracts all export kinds', async () => {
      const result = await extractSpec({
        entryFile: 'test.ts',
        content: FIXTURE_CODE.basic,
      });

      const kinds = new Set(result.spec.exports.map(e => e.kind));
      expect(kinds.has('function')).toBe(true);
      expect(kinds.has('interface')).toBe(true);
      expect(kinds.has('variable')).toBe(true);
    });

    test('extracts class exports', async () => {
      const result = await extractSpec({
        entryFile: 'test.ts',
        content: FIXTURE_CODE.withClasses,
      });

      const classExport = result.spec.exports.find(e => e.kind === 'class');
      expect(classExport).toBeDefined();
      expect(classExport!.name).toBe('Service');
    });

    test('extracts enum exports', async () => {
      const result = await extractSpec({
        entryFile: 'test.ts',
        content: FIXTURE_CODE.withEnums,
      });

      const enums = result.spec.exports.filter(e => e.kind === 'enum');
      expect(enums.length).toBe(2);
    });

    test('includes types array', async () => {
      const result = await extractSpec({
        entryFile: 'test.ts',
        content: FIXTURE_CODE.basic,
      });

      expect(result.spec.types).toBeInstanceOf(Array);
    });
  });

  describe('output modes', () => {
    test('extractSpec returns result object directly', async () => {
      const result = await extractSpec({
        entryFile: 'test.ts',
        content: FIXTURE_CODE.basic,
      });

      // SDK returns result directly - CLI handles stdout/file writing
      expect(result.spec).toBeDefined();
      expect(result.diagnostics).toBeDefined();
    });

    test('spec can be serialized to JSON', async () => {
      const result = await extractSpec({
        entryFile: 'test.ts',
        content: FIXTURE_CODE.basic,
      });

      const json = JSON.stringify(result.spec, null, 2);
      const parsed = JSON.parse(json);

      expect(parsed.openpkg).toBeDefined();
      expect(parsed.exports).toBeInstanceOf(Array);
    });

    test('spec output is deterministic', async () => {
      const result1 = await extractSpec({
        entryFile: 'test.ts',
        content: FIXTURE_CODE.basic,
      });
      const result2 = await extractSpec({
        entryFile: 'test.ts',
        content: FIXTURE_CODE.basic,
      });

      // Export names and kinds should be consistent
      const names1 = result1.spec.exports.map(e => e.name).sort();
      const names2 = result2.spec.exports.map(e => e.name).sort();
      expect(names1).toEqual(names2);
    });
  });

  describe('filtering with --only', () => {
    test('filters to exact match', async () => {
      const result = await extractSpec({
        entryFile: 'test.ts',
        content: FIXTURE_CODE.forFiltering,
        only: ['createUser'],
      });

      expect(result.spec.exports.length).toBe(1);
      expect(result.spec.exports[0].name).toBe('createUser');
    });

    test('filters with wildcard prefix', async () => {
      const result = await extractSpec({
        entryFile: 'test.ts',
        content: FIXTURE_CODE.forFiltering,
        only: ['create*'],
      });

      expect(result.spec.exports.length).toBe(2);
      expect(result.spec.exports.every(e => e.name.startsWith('create'))).toBe(true);
    });

    test('filters with wildcard suffix', async () => {
      const result = await extractSpec({
        entryFile: 'test.ts',
        content: FIXTURE_CODE.forFiltering,
        only: ['*User'],
      });

      const names = result.spec.exports.map(e => e.name);
      expect(names.every(n => n.endsWith('User'))).toBe(true);
    });

    test('filters multiple patterns', async () => {
      const result = await extractSpec({
        entryFile: 'test.ts',
        content: FIXTURE_CODE.forFiltering,
        only: ['createUser', 'MAX_USERS'],
      });

      expect(result.spec.exports.length).toBe(2);
      const names = result.spec.exports.map(e => e.name);
      expect(names).toContain('createUser');
      expect(names).toContain('MAX_USERS');
    });

    test('returns empty exports when no matches', async () => {
      const result = await extractSpec({
        entryFile: 'test.ts',
        content: FIXTURE_CODE.forFiltering,
        only: ['nonExistent'],
      });

      expect(result.spec.exports.length).toBe(0);
    });
  });

  describe('filtering with --ignore', () => {
    test('ignores exact match', async () => {
      const result = await extractSpec({
        entryFile: 'test.ts',
        content: FIXTURE_CODE.forFiltering,
        ignore: ['deleteUser'],
      });

      const names = result.spec.exports.map(e => e.name);
      expect(names).not.toContain('deleteUser');
    });

    test('ignores with wildcard', async () => {
      const result = await extractSpec({
        entryFile: 'test.ts',
        content: FIXTURE_CODE.forFiltering,
        ignore: ['*User'],
      });

      const names = result.spec.exports.map(e => e.name);
      expect(names.some(n => n.endsWith('User'))).toBe(false);
    });

    test('ignores multiple patterns', async () => {
      const result = await extractSpec({
        entryFile: 'test.ts',
        content: FIXTURE_CODE.forFiltering,
        ignore: ['deleteUser', 'MAX_USERS'],
      });

      const names = result.spec.exports.map(e => e.name);
      expect(names).not.toContain('deleteUser');
      expect(names).not.toContain('MAX_USERS');
    });

    test('only and ignore can combine', async () => {
      const result = await extractSpec({
        entryFile: 'test.ts',
        content: FIXTURE_CODE.forFiltering,
        only: ['create*'],
        ignore: ['createPost'],
      });

      expect(result.spec.exports.length).toBe(1);
      expect(result.spec.exports[0].name).toBe('createUser');
    });
  });

  describe('verification', () => {
    test('includes verification stats', async () => {
      const result = await extractSpec({
        entryFile: 'test.ts',
        content: FIXTURE_CODE.basic,
      });

      // Verification is always included
      expect(result.verification).toBeDefined();
      expect(typeof result.verification!.discovered).toBe('number');
      expect(typeof result.verification!.extracted).toBe('number');
      expect(typeof result.verification!.failed).toBe('number');
    });

    test('verification tracks filtered exports', async () => {
      const result = await extractSpec({
        entryFile: 'test.ts',
        content: FIXTURE_CODE.forFiltering,
        only: ['createUser'],
      });

      // Some exports should be skipped due to filter
      expect(result.verification!.skipped).toBeGreaterThan(0);
    });

    test('verification details include skip reasons', async () => {
      const result = await extractSpec({
        entryFile: 'test.ts',
        content: FIXTURE_CODE.forFiltering,
        only: ['createUser'],
      });

      if (result.verification!.skipped > 0) {
        expect(result.verification!.details.skipped.length).toBeGreaterThan(0);
        expect(result.verification!.details.skipped[0].reason).toBe('filtered');
      }
    });
  });

  describe('error handling', () => {
    test('handles empty file gracefully', async () => {
      const result = await extractSpec({
        entryFile: 'test.ts',
        content: FIXTURE_CODE.empty,
      });

      expect(result.spec.exports.length).toBe(0);
      // Should not throw
    });

    test('returns diagnostics for issues', async () => {
      const result = await extractSpec({
        entryFile: 'test.ts',
        content: FIXTURE_CODE.basic,
      });

      expect(result.diagnostics).toBeInstanceOf(Array);
      // Diagnostics may be empty for valid code
    });

    test('diagnostics have correct structure', async () => {
      const result = await extractSpec({
        entryFile: 'test.ts',
        content: FIXTURE_CODE.basic,
      });

      for (const diag of result.diagnostics) {
        expect(typeof diag.message).toBe('string');
        expect(['error', 'warning', 'info']).toContain(diag.severity);
      }
    });
  });

  describe('output structure', () => {
    test('spec has openpkg version', async () => {
      const result = await extractSpec({
        entryFile: 'test.ts',
        content: FIXTURE_CODE.basic,
      });

      expect(result.spec.openpkg).toMatch(/^\d+\.\d+\.\d+/);
    });

    test('spec has meta object', async () => {
      const result = await extractSpec({
        entryFile: 'test.ts',
        content: FIXTURE_CODE.basic,
      });

      expect(result.spec.meta).toBeDefined();
      expect(typeof result.spec.meta).toBe('object');
    });

    test('exports have required fields', async () => {
      const result = await extractSpec({
        entryFile: 'test.ts',
        content: FIXTURE_CODE.basic,
      });

      for (const exp of result.spec.exports) {
        expect(exp.id).toBeDefined();
        expect(exp.name).toBeDefined();
        expect(exp.kind).toBeDefined();
      }
    });

    test('function exports have signatures', async () => {
      const result = await extractSpec({
        entryFile: 'test.ts',
        content: FIXTURE_CODE.basic,
      });

      const fn = result.spec.exports.find(e => e.kind === 'function');
      expect(fn).toBeDefined();
      expect(fn!.signatures).toBeDefined();
    });

    test('interface exports have members', async () => {
      const result = await extractSpec({
        entryFile: 'test.ts',
        content: FIXTURE_CODE.basic,
      });

      const iface = result.spec.exports.find(e => e.kind === 'interface');
      expect(iface).toBeDefined();
      expect(iface!.members).toBeDefined();
    });
  });

  describe('options', () => {
    test('maxTypeDepth option respected', async () => {
      const result = await extractSpec({
        entryFile: 'test.ts',
        content: FIXTURE_CODE.basic,
        maxTypeDepth: 1,
      });

      // Should complete without error with reduced depth
      expect(result.spec).toBeDefined();
    });

    test('resolveExternalTypes option', async () => {
      const result = await extractSpec({
        entryFile: 'test.ts',
        content: FIXTURE_CODE.basic,
        resolveExternalTypes: false,
      });

      expect(result.spec).toBeDefined();
    });

    test('schemaExtraction option', async () => {
      const result = await extractSpec({
        entryFile: 'test.ts',
        content: FIXTURE_CODE.basic,
        schemaExtraction: 'static',
      });

      expect(result.spec).toBeDefined();
    });
  });

  describe('performance', () => {
    test('spec generation completes in reasonable time', async () => {
      const start = performance.now();
      const result = await extractSpec({
        entryFile: 'test.ts',
        content: FIXTURE_CODE.basic,
      });
      const elapsed = performance.now() - start;

      expect(result.spec).toBeDefined();
      // 3s is generous for CI environments
      expect(elapsed).toBeLessThan(3000);
    });

    test('filtered extraction is fast', async () => {
      const start = performance.now();
      const result = await extractSpec({
        entryFile: 'test.ts',
        content: FIXTURE_CODE.forFiltering,
        only: ['createUser'],
      });
      const elapsed = performance.now() - start;

      expect(result.spec.exports.length).toBe(1);
      expect(elapsed).toBeLessThan(3000);
    });
  });
});
