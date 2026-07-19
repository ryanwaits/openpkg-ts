import { describe, expect, test } from 'bun:test';
import type { SpecSchema } from '@openpkg-ts/spec';
import { extract } from '../builder/spec-builder';

/**
 * Flattened schema.properties must carry per-property description/deprecated
 * (dogfood round 3, Item 3): consumers reading only the schema layer — not
 * exports[].members[] — need doc comments too.
 */

type SchemaObj = Record<string, SpecSchema> | undefined;

function props(schema: SpecSchema | undefined): SchemaObj {
  return (schema as { properties?: Record<string, SpecSchema> } | undefined)?.properties;
}

describe('schema.properties descriptions + deprecated', () => {
  test('interface props carry description and deprecated in flattened schema', async () => {
    const code = `
      export interface Config {
        /** Host to send events to */
        api_host: string;
        /**
         * Old host setting.
         * @deprecated Use api_host instead
         */
        old_host?: string;
        undocumented?: number;
      }
    `;

    const { spec } = await extract({ entryFile: 'test.ts', content: code });
    const iface = spec.exports.find((e) => e.name === 'Config');
    const p = props(iface?.schema);
    expect(p).toBeDefined();
    expect((p?.api_host as { description?: string }).description).toBe('Host to send events to');
    const oldHost = p?.old_host as {
      description?: string;
      deprecated?: boolean;
      'x-deprecated-reason'?: string;
    };
    expect(oldHost.deprecated).toBe(true);
    expect(oldHost['x-deprecated-reason']).toBe('Use api_host instead');
    expect(oldHost.description).toBe('Old host setting.');
    expect((p?.undocumented as { description?: string }).description).toBeUndefined();
    expect((p?.undocumented as { deprecated?: boolean }).deprecated).toBeUndefined();
  });

  test('intersection alias props carry descriptions in flattened schema', async () => {
    const code = `
      interface Base {
        /** Documented base prop */
        base_prop: string;
        loaded: boolean;
      }
      export type Config = Omit<Base, 'loaded'> & {
        /** Extra flag */
        extra?: boolean;
        /** @deprecated gone soon */
        legacy?: string;
      };
    `;

    const { spec } = await extract({ entryFile: 'test.ts', content: code });
    const alias = spec.exports.find((e) => e.name === 'Config');
    expect(alias).toBeDefined();
    // Flattened registry/type schema — resolve through types[] if export schema is a shell
    const registry = spec.types?.find((t) => t.name === 'Config');
    const schema = registry?.schema ?? alias?.schema;
    const flat = props(schema);
    expect(flat).toBeDefined();
    expect((flat?.base_prop as { description?: string }).description).toBe('Documented base prop');
    expect((flat?.extra as { description?: string }).description).toBe('Extra flag');
    expect((flat?.legacy as { deprecated?: boolean }).deprecated).toBe(true);
  });

  test('description on a $ref prop wraps in allOf preserving the ref', async () => {
    const code = `
      export interface Inner { a: string; }
      export interface Outer {
        /** Documented ref prop */
        inner: Inner;
      }
    `;

    const { spec } = await extract({ entryFile: 'test.ts', content: code });
    const outer = spec.exports.find((e) => e.name === 'Outer');
    const p = props(outer?.schema);
    const inner = p?.inner as { allOf?: unknown[]; $ref?: string; description?: string };
    expect(inner.description).toBe('Documented ref prop');
    // pure $ref must survive inside allOf rather than being clobbered
    if (!inner.$ref) {
      expect(inner.allOf?.some((b) => (b as { $ref?: string }).$ref)).toBe(true);
    }
  });
});
