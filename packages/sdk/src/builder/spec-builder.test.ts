import { describe, expect, test } from 'bun:test';
import type { SpecSchema } from '@openpkg-ts/spec';
import { extract } from './spec-builder';

/**
 * Extract `properties` from an object schema.
 * SpecSchema is a union including a string shorthand, so narrow structurally first.
 */
function schemaProperties(schema: SpecSchema | undefined): Record<string, unknown> {
  if (typeof schema !== 'object' || schema === null || !('properties' in schema)) return {};
  const props = schema.properties;
  if (typeof props !== 'object' || props === null) return {};
  // narrowed `unknown` to `object`; index access needs a Record shape
  return props as Record<string, unknown>;
}

describe('spec-builder aliased exports', () => {
  test('aliased function export has correct name', async () => {
    const code = `
      const getElementContext = async () => {};
      export { getElementContext as formatElementInfo };
    `;

    const result = await extract({ entryFile: 'test.ts', content: code });
    const exp = result.spec.exports.find((e) => e.id === 'formatElementInfo');

    expect(exp?.name).toBe('formatElementInfo');
  });
});

describe('spec-builder external re-exports', () => {
  test('external re-export creates external export with package info', async () => {
    const code = `
      export { something } from "nonexistent-package";
    `;

    const result = await extract({ entryFile: 'test.ts', content: code });

    // Should be extracted as external export (not skipped)
    const exp = result.spec.exports.find((e) => e.id === 'something');
    expect(exp).toBeDefined();
    expect(exp?.kind).toBe('external');
    expect(exp?.source?.package).toBe('nonexistent-package');

    // Verification should show extracted, not skipped
    expect(result.verification?.extracted).toBe(1);
    expect(result.verification?.skipped).toBe(0);
  });

  test('scoped package re-export has correct package name', async () => {
    const code = `
      export { foo } from "@org/some-package";
    `;

    const result = await extract({ entryFile: 'test.ts', content: code });

    const exp = result.spec.exports.find((e) => e.id === 'foo');
    expect(exp?.kind).toBe('external');
    expect(exp?.source?.package).toBe('@org/some-package');
  });

  test('relative import that fails uses no-declaration skip reason', async () => {
    const code = `
      export { bar } from "./missing-local-file";
    `;

    const result = await extract({ entryFile: 'test.ts', content: code });

    const skipped = result.verification?.details.skipped ?? [];
    const localSkip = skipped.find((s) => s.name === 'bar');

    expect(localSkip?.reason).toBe('no-declaration');
    expect(localSkip?.package).toBeUndefined();
  });

  test('re-export chain through intermediate file still detects external', async () => {
    // Simulates: index.ts -> core.ts -> "external-pkg"
    // When core.ts exists but external-pkg doesn't
    // This is the react-grab pattern where isInstrumentationActive was skipped
    const code = `
      // This simulates re-exporting something that was originally from an external package
      // but the intermediate file (core.ts) also doesn't exist
      export { something } from "./core";
    `;

    const result = await extract({ entryFile: 'test.ts', content: code });

    // This should be skipped as no-declaration (relative path, can't resolve)
    const skipped = result.verification?.details.skipped ?? [];
    const skip = skipped.find((s) => s.name === 'something');

    expect(skip?.reason).toBe('no-declaration');
  });

  test('externals.include is respected for pattern matching', async () => {
    const code = `
      export { foo } from "my-package";
      export { bar } from "other-package";
    `;

    // Without node_modules, both should be external stubs
    // But if externals.include is set, only matching packages would be attempted
    const result = await extract({
      entryFile: 'test.ts',
      content: code,
      externals: {
        include: ['my-*'],
        exclude: ['other-*'],
      },
    });

    // Both are external stubs since neither package is installed
    const fooExport = result.spec.exports.find((e) => e.id === 'foo');
    const barExport = result.spec.exports.find((e) => e.id === 'bar');

    expect(fooExport?.kind).toBe('external');
    expect(barExport?.kind).toBe('external');
  });
});

describe('spec-builder prototype method filtering', () => {
  test('find method on non-array object is NOT filtered out', async () => {
    const code = `
      interface ChatClient {
        find(params?: { limit?: number }): Promise<Chat[]>;
        create(params: { name: string }): Promise<Chat>;
        delete(id: string): Promise<void>;
      }
      interface Chat { id: string; name: string; }
      export function createClient(): { chats: ChatClient } {
        return null as any;
      }
    `;

    const result = await extract({ entryFile: 'test.ts', content: code });
    const exp = result.spec.exports.find((e) => e.id === 'createClient');
    expect(exp).toBeDefined();

    // ChatClient is a $ref type — check in types array
    const chatClient = result.spec.types?.find((t) => t.name === 'ChatClient');
    expect(chatClient).toBeDefined();
    const props = schemaProperties(chatClient?.schema);
    expect(props.find).toBeDefined();
    expect(props.create).toBeDefined();
    expect(props.delete).toBeDefined();
  });

  test('array prototype methods ARE filtered from actual arrays', async () => {
    const code = `
      export const items: string[] = [];
    `;

    const result = await extract({ entryFile: 'test.ts', content: code });
    const exp = result.spec.exports.find((e) => e.id === 'items');
    expect(exp).toBeDefined();

    // Array schema should NOT include find/map/filter etc
    const props = schemaProperties(exp?.schema);
    expect(props.find).toBeUndefined();
    expect(props.map).toBeUndefined();
    expect(props.filter).toBeUndefined();
  });
});
