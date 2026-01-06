import { describe, expect, test } from 'bun:test';
import { extract } from './spec-builder';

describe('forgotten exports detection', () => {
  test('should not flag re-exported external types as forgotten', async () => {
    // Simulates: export type { ExternalType } from 'external-package'
    // When a type is re-exported from an external package, it's part of the public API
    // and should NOT be flagged as a forgotten export
    const code = `
      // Simulating a re-exported type that appears in the public API
      // The type is exported, so it should be in exportedIds
      export interface ExternalType {
        value: string;
      }

      export interface UsesExternal {
        data: ExternalType;
      }
    `;

    const result = await extract({
      entryFile: 'test.ts',
      content: code,
    });

    // ExternalType is exported, so it should NOT be in forgottenExports
    const forgottenExternalType = result.forgottenExports?.find(
      (f) => f.name === 'ExternalType'
    );
    expect(forgottenExternalType).toBeUndefined();
  });

  test('should still flag types that are referenced but not exported', async () => {
    // InternalType is defined but NOT exported
    // It's used in UsesInternal's type signature, so it should be flagged
    const code = `
      interface InternalType {
        x: number;
      }

      export interface UsesInternal {
        value: InternalType;
      }
    `;

    const result = await extract({
      entryFile: 'test.ts',
      content: code,
    });

    // InternalType SHOULD be in forgottenExports since it's not exported
    const forgottenInternal = result.forgottenExports?.find(
      (f) => f.name === 'InternalType'
    );
    expect(forgottenInternal).toBeDefined();
    expect(forgottenInternal?.name).toBe('InternalType');
    expect(forgottenInternal?.isExternal).toBe(false);
  });

  test('should not flag exported type aliases as forgotten', async () => {
    // Type alias that IS exported should not be flagged
    const code = `
      export type MyCallback = (value: string) => void;

      export interface Config {
        onChange: MyCallback;
      }
    `;

    const result = await extract({
      entryFile: 'test.ts',
      content: code,
    });

    // MyCallback is exported, should NOT be forgotten
    const forgottenCallback = result.forgottenExports?.find(
      (f) => f.name === 'MyCallback'
    );
    expect(forgottenCallback).toBeUndefined();
  });

  test('should flag non-exported interfaces used in properties as forgotten', async () => {
    // Interface that is NOT exported but used in a property should be flagged
    const code = `
      interface CallbackOptions {
        retryCount: number;
        timeout: number;
      }

      export interface Config {
        options: CallbackOptions;
      }
    `;

    const result = await extract({
      entryFile: 'test.ts',
      content: code,
    });

    // CallbackOptions is NOT exported, should be forgotten
    const forgottenOptions = result.forgottenExports?.find(
      (f) => f.name === 'CallbackOptions'
    );
    expect(forgottenOptions).toBeDefined();
    expect(forgottenOptions?.name).toBe('CallbackOptions');
  });

  test('should handle multiple levels of type references correctly', async () => {
    // Test nested type references - only truly forgotten ones should be flagged
    const code = `
      interface DeepInternal {
        deep: boolean;
      }

      export interface MiddleType {
        nested: DeepInternal;
      }

      export interface TopLevel {
        middle: MiddleType;
      }
    `;

    const result = await extract({
      entryFile: 'test.ts',
      content: code,
    });

    // MiddleType is exported - should NOT be forgotten
    expect(
      result.forgottenExports?.find((f) => f.name === 'MiddleType')
    ).toBeUndefined();

    // DeepInternal is NOT exported - should be forgotten
    const forgottenDeep = result.forgottenExports?.find(
      (f) => f.name === 'DeepInternal'
    );
    expect(forgottenDeep).toBeDefined();
  });
});
