import { describe, expect, test } from 'bun:test';
import { extract } from '../builder/spec-builder';

describe('deprecated flag extraction', () => {
  test('extracts @deprecated from function', async () => {
    const code = `
      /**
       * @deprecated Use newFunction instead
       */
      export function oldFunction(): void {}
    `;

    const result = await extract({
      entryFile: 'test.ts',
      content: code,
    });

    const fn = result.spec.exports.find((e) => e.name === 'oldFunction');
    expect(fn).toBeDefined();
    expect(fn?.deprecated).toBe(true);
  });

  test('extracts @deprecated from interface', async () => {
    const code = `
      /**
       * @deprecated Use NewInterface instead
       */
      export interface OldInterface {
        value: string;
      }
    `;

    const result = await extract({
      entryFile: 'test.ts',
      content: code,
    });

    const iface = result.spec.exports.find((e) => e.name === 'OldInterface');
    expect(iface).toBeDefined();
    expect(iface?.deprecated).toBe(true);
  });

  test('extracts @deprecated from type alias', async () => {
    const code = `
      /**
       * @deprecated Use NewType instead
       */
      export type OldType = string | number;
    `;

    const result = await extract({
      entryFile: 'test.ts',
      content: code,
    });

    const typeAlias = result.spec.exports.find((e) => e.name === 'OldType');
    expect(typeAlias).toBeDefined();
    expect(typeAlias?.deprecated).toBe(true);
  });

  test('extracts @deprecated from variable', async () => {
    const code = `
      /**
       * @deprecated Use newConfig instead
       */
      export const oldConfig = { key: 'value' };
    `;

    const result = await extract({
      entryFile: 'test.ts',
      content: code,
    });

    const variable = result.spec.exports.find((e) => e.name === 'oldConfig');
    expect(variable).toBeDefined();
    expect(variable?.deprecated).toBe(true);
  });

  test('extracts @deprecated from class', async () => {
    const code = `
      /**
       * @deprecated Use NewClass instead
       */
      export class OldClass {
        value: number = 0;
      }
    `;

    const result = await extract({
      entryFile: 'test.ts',
      content: code,
    });

    const cls = result.spec.exports.find((e) => e.name === 'OldClass');
    expect(cls).toBeDefined();
    expect(cls?.deprecated).toBe(true);
  });

  test('extracts @deprecated from enum', async () => {
    const code = `
      /**
       * @deprecated Use NewStatus instead
       */
      export enum OldStatus {
        Active = 'active',
        Inactive = 'inactive',
      }
    `;

    const result = await extract({
      entryFile: 'test.ts',
      content: code,
    });

    const enumExport = result.spec.exports.find((e) => e.name === 'OldStatus');
    expect(enumExport).toBeDefined();
    expect(enumExport?.deprecated).toBe(true);
  });

  test('does not set deprecated when not present', async () => {
    const code = `
      /**
       * A normal function without deprecation
       */
      export function normalFunction(): void {}

      export interface NormalInterface {
        value: string;
      }

      export type NormalType = string;

      export const normalConfig = { key: 'value' };

      export class NormalClass {
        value: number = 0;
      }

      export enum NormalStatus {
        Active = 'active',
      }
    `;

    const result = await extract({
      entryFile: 'test.ts',
      content: code,
    });

    // All exports should NOT have deprecated flag set
    for (const exp of result.spec.exports) {
      expect(exp.deprecated).toBeUndefined();
    }
  });

  test('handles @deprecated tag without message', async () => {
    const code = `
      /**
       * @deprecated
       */
      export function deprecatedNoMessage(): void {}
    `;

    const result = await extract({
      entryFile: 'test.ts',
      content: code,
    });

    const fn = result.spec.exports.find((e) => e.name === 'deprecatedNoMessage');
    expect(fn).toBeDefined();
    expect(fn?.deprecated).toBe(true);
  });
});
