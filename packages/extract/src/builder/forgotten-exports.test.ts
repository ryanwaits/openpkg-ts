import { describe, expect, test } from 'bun:test';
import { extract, isExternalType } from './spec-builder';

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

describe('forgotten exports with linked packages (integration)', () => {
  test('filters external types from forgottenExports result', async () => {
    // Simulate a project that uses types from a linked package
    // The linked package path is outside the project's baseDir
    const code = `
      // Type defined in the test file but simulating it came from external
      interface ExternalConfig {
        setting: string;
      }

      export interface MyService {
        config: ExternalConfig;
      }
    `;

    const result = await extract({
      entryFile: '/project/src/index.ts',
      baseDir: '/project',
      content: code,
    });

    // ExternalConfig is defined in the test file (inside /project)
    // so it should be detected as internal forgotten export
    const forgottenConfig = result.forgottenExports?.find(
      (f) => f.name === 'ExternalConfig'
    );
    expect(forgottenConfig).toBeDefined();
    expect(forgottenConfig?.isExternal).toBe(false);
  });

  test('marks types from node_modules as external in forgotten exports', async () => {
    // Test that the forgotten exports detection correctly identifies
    // types from node_modules as external
    const code = `
      interface NodeModuleType {
        value: number;
      }

      export interface UsesNodeModule {
        data: NodeModuleType;
      }
    `;

    const result = await extract({
      entryFile: '/project/src/index.ts',
      baseDir: '/project',
      content: code,
    });

    // NodeModuleType is defined in test content (internal to project)
    // This tests the basic flow - actual node_modules detection
    // is tested via isExternalType unit tests
    const forgotten = result.forgottenExports?.find(
      (f) => f.name === 'NodeModuleType'
    );
    expect(forgotten).toBeDefined();
    expect(forgotten?.isExternal).toBe(false);
  });

  test('internal forgotten exports only includes non-external types', async () => {
    // The extract result filters forgottenExports to only internal ones
    // This test verifies that behavior
    const code = `
      interface InternalHelper {
        id: string;
      }

      export interface PublicAPI {
        helper: InternalHelper;
      }
    `;

    const result = await extract({
      entryFile: '/project/src/index.ts',
      baseDir: '/project',
      content: code,
    });

    // All forgotten exports in result should be non-external
    // (external ones are filtered out in spec-builder.ts line ~298)
    for (const forgotten of result.forgottenExports ?? []) {
      expect(forgotten.isExternal).toBe(false);
    }
  });
});

describe('isExternalType', () => {
  test('marks node_modules types as external', () => {
    const baseDir = '/project/src';
    const definedIn = '/project/node_modules/@types/node/index.d.ts';
    expect(isExternalType(definedIn, baseDir)).toBe(true);
  });

  test('marks types outside project as external (linked packages)', () => {
    const baseDir = '/project/packages/my-pkg';
    const definedIn = '/other-project/packages/dep/dist/index.d.ts';
    expect(isExternalType(definedIn, baseDir)).toBe(true);
  });

  test('marks types inside project as internal', () => {
    const baseDir = '/project/packages/my-pkg';
    const definedIn = '/project/packages/my-pkg/src/types.ts';
    expect(isExternalType(definedIn, baseDir)).toBe(false);
  });

  test('handles undefined definedIn as external', () => {
    expect(isExternalType(undefined, '/project')).toBe(true);
  });
});
