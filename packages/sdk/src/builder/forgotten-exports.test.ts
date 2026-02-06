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
    const forgottenExternalType = result.forgottenExports?.find((f) => f.name === 'ExternalType');
    expect(forgottenExternalType).toBeUndefined();
  });

  test('should auto-register referenced but non-exported types into spec.types', async () => {
    // InternalType is defined but NOT exported
    // Post-process pass should register it into spec.types via $ref resolution
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

    // InternalType should now be auto-registered in spec.types (not forgotten)
    const registeredType = result.spec.types?.find((t) => t.id === 'InternalType');
    expect(registeredType).toBeDefined();
    expect(result.forgottenExports?.find((f) => f.name === 'InternalType')).toBeUndefined();
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
    const forgottenCallback = result.forgottenExports?.find((f) => f.name === 'MyCallback');
    expect(forgottenCallback).toBeUndefined();
  });

  test('should auto-register non-exported interfaces used in properties', async () => {
    // Interface that is NOT exported but used in a property should be auto-registered
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

    // CallbackOptions should now be auto-registered in spec.types
    const registeredType = result.spec.types?.find((t) => t.id === 'CallbackOptions');
    expect(registeredType).toBeDefined();
    expect(result.forgottenExports?.find((f) => f.name === 'CallbackOptions')).toBeUndefined();
  });

  test('should auto-register nested type references at all levels', async () => {
    // Test nested type references - non-exported types should be auto-registered
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
    expect(result.forgottenExports?.find((f) => f.name === 'MiddleType')).toBeUndefined();

    // DeepInternal should be auto-registered in spec.types (not forgotten)
    const registeredDeep = result.spec.types?.find((t) => t.id === 'DeepInternal');
    expect(registeredDeep).toBeDefined();
    expect(result.forgottenExports?.find((f) => f.name === 'DeepInternal')).toBeUndefined();
  });
});

describe('forgotten exports with linked packages (integration)', () => {
  test('auto-registers internal types from linked packages', async () => {
    // Type defined in the test file (inside /project)
    // should be auto-registered into spec.types, not left as forgotten
    const code = `
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

    // ExternalConfig should be auto-registered in spec.types
    const registeredType = result.spec.types?.find((t) => t.id === 'ExternalConfig');
    expect(registeredType).toBeDefined();
    expect(result.forgottenExports?.find((f) => f.name === 'ExternalConfig')).toBeUndefined();
  });

  test('auto-registers types resolvable from source scope', async () => {
    // Types defined in the same file should be auto-registered
    // into spec.types via the post-process $ref resolution pass
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

    // NodeModuleType should be auto-registered in spec.types
    const registeredType = result.spec.types?.find((t) => t.id === 'NodeModuleType');
    expect(registeredType).toBeDefined();
    expect(result.forgottenExports?.find((f) => f.name === 'NodeModuleType')).toBeUndefined();
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
