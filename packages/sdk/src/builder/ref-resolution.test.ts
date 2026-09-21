import { describe, expect, test } from 'bun:test';
import { extract } from './spec-builder';

/** Single-char uppercase names are generic params, not real types */
const GENERIC_PARAM = /^[A-Z]$/;

/**
 * Recursively collect all $ref strings from a value (schema, export, type).
 */
function collectRefs(obj: unknown, refs: Set<string> = new Set()): Set<string> {
  if (obj == null || typeof obj !== 'object') return refs;
  if (Array.isArray(obj)) {
    for (const item of obj) collectRefs(item, refs);
    return refs;
  }
  for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
    if (key === '$ref' && typeof val === 'string' && val.startsWith('#/types/')) {
      const name = val.replace('#/types/', '');
      if (!GENERIC_PARAM.test(name)) refs.add(name);
    }
    collectRefs(val, refs);
  }
  return refs;
}

describe('$ref resolution rate', () => {
  test('simple cross-type references all resolve', async () => {
    const code = `
      export interface User {
        id: string;
        profile: Profile;
      }

      interface Profile {
        name: string;
        address: Address;
      }

      interface Address {
        street: string;
        city: string;
      }

      export function getUser(id: string): User {
        return {} as User;
      }
    `;

    const result = await extract({ entryFile: 'test.ts', content: code });
    const allRefs = collectRefs(result.spec.exports);
    const typeIds = new Set(result.spec.types?.map((t) => t.id) ?? []);

    // Every $ref in exports should resolve to a type in spec.types
    const unresolved = [...allRefs].filter((ref) => !typeIds.has(ref));
    expect(unresolved).toEqual([]);
  });

  test('nested generic references resolve', async () => {
    const code = `
      export interface Response<T> {
        data: T;
        error: ErrorInfo | null;
      }

      interface ErrorInfo {
        code: number;
        message: string;
      }

      export function fetchData(): Response<string> {
        return {} as Response<string>;
      }
    `;

    const result = await extract({ entryFile: 'test.ts', content: code });
    const allRefs = collectRefs(result.spec.exports);
    const typeRefs = collectRefs(result.spec.types);
    const combined = new Set([...allRefs, ...typeRefs]);
    const typeIds = new Set(result.spec.types?.map((t) => t.id) ?? []);

    const unresolved = [...combined].filter((ref) => !typeIds.has(ref));
    expect(unresolved).toEqual([]);
  });

  test('resolution rate baseline for union-heavy code', async () => {
    const code = `
      export type Result = Success | Failure | Pending;

      interface Success {
        status: 'success';
        data: Payload;
      }

      interface Failure {
        status: 'failure';
        error: ErrorDetail;
      }

      interface Pending {
        status: 'pending';
      }

      interface Payload {
        items: Item[];
      }

      interface Item {
        id: string;
        meta: ItemMeta;
      }

      interface ItemMeta {
        created: string;
      }

      interface ErrorDetail {
        code: number;
        message: string;
      }
    `;

    const result = await extract({ entryFile: 'test.ts', content: code });
    const allRefs = collectRefs(result.spec.exports);
    const typeRefs = collectRefs(result.spec.types);
    const combined = new Set([...allRefs, ...typeRefs]);
    const typeIds = new Set(result.spec.types?.map((t) => t.id) ?? []);

    const resolved = [...combined].filter((ref) => typeIds.has(ref));
    const rate = combined.size > 0 ? (resolved.length / combined.size) * 100 : 100;

    expect(rate).toBeGreaterThanOrEqual(90);
  });

  test('a type imported from an unresolved module refs its written name', async () => {
    const code = `
      import type { Missing, Gen } from 'missing-pkg';
      export declare function f(x: Missing, g: Gen<string>): void;
    `;

    const { spec } = await extract({ entryFile: 'test.ts', content: code });
    const params = spec.exports[0].signatures?.[0].parameters ?? [];
    const typeIds = new Set(spec.types?.map((t) => t.id));

    // Was `#/types/unknown`: the checker aliases such imports to its unknown symbol
    expect(params[0].schema).toEqual({ $ref: '#/types/Missing' });
    expect(params[1].schema).toMatchObject({ $ref: '#/types/Gen' });
    expect([...collectRefs(spec.exports)].filter((ref) => !typeIds.has(ref))).toEqual([]);
  });
});
