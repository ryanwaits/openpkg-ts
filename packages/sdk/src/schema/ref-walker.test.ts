import { describe, expect, test } from 'bun:test';
import type { OpenPkg, SpecSchema } from '@openpkg-ts/spec';
import { bundleRefs, stripTsExtensions } from './ref-walker';

const spec = (types: OpenPkg['types']): OpenPkg =>
  ({
    openpkg: '0.4.0',
    meta: { name: 'test' },
    exports: [],
    types,
  }) as OpenPkg;

describe('bundleRefs', () => {
  test('rewrites #/types/X to #/$defs/X and collects the def', () => {
    const s = spec([{ id: 'User', name: 'User', kind: 'interface', schema: { type: 'object' } }]);
    const result = bundleRefs({ $ref: '#/types/User' } as SpecSchema, s);
    expect(result.schema).toEqual({ $ref: '#/$defs/User' });
    expect(result.defs.User).toEqual({ type: 'object' });
  });

  test('resolves by id, falling back to name', () => {
    const s = spec([{ id: 'u1', name: 'User', kind: 'interface', schema: { type: 'object' } }]);
    const byName = bundleRefs({ $ref: '#/types/User' } as SpecSchema, s);
    expect(byName.defs.User).toBeDefined();
    const byId = bundleRefs({ $ref: '#/types/u1' } as SpecSchema, s);
    expect(byId.defs.u1).toBeDefined();
  });

  test('cycle terminates with a self-reference into $defs', () => {
    const s = spec([
      {
        id: 'Node',
        name: 'Node',
        kind: 'interface',
        schema: { type: 'object', properties: { next: { $ref: '#/types/Node' } } },
      },
    ]);
    const result = bundleRefs({ $ref: '#/types/Node' } as SpecSchema, s);
    expect(result.schema).toEqual({ $ref: '#/$defs/Node' });
    const props = (result.defs.Node as Record<string, Record<string, unknown>>).properties;
    expect(props.next).toEqual({ $ref: '#/$defs/Node' });
  });

  test('dangling ref → {} + warning (permissive)', () => {
    const result = bundleRefs({ $ref: '#/types/Missing' } as SpecSchema, spec([]));
    expect(result.schema).toEqual({});
    expect(result.warnings.some((w) => w.includes('Missing'))).toBe(true);
  });

  test('dangling ref throws under onUnresolved: error', () => {
    expect(() =>
      bundleRefs({ $ref: '#/types/Missing' } as SpecSchema, spec([]), { onUnresolved: 'error' }),
    ).toThrow();
  });

  test('type parameter ref → {} + warning', () => {
    const result = bundleRefs({ $ref: '#/types/T' } as SpecSchema, spec([]), {
      typeParameterNames: ['T'],
    });
    expect(result.schema).toEqual({});
    expect(result.warnings.some((w) => w.includes('T'))).toBe(true);
  });

  test('builtin refs are inlined structurally', () => {
    const s = spec([]);
    const date = bundleRefs({ $ref: '#/types/Date' } as SpecSchema, s);
    expect(date.schema).toEqual({ type: 'string', format: 'date-time' });
    const bytes = bundleRefs({ $ref: '#/types/Uint8Array' } as SpecSchema, s);
    expect(bytes.schema).toEqual({ type: 'string', format: 'byte' });
    const map = bundleRefs({ $ref: '#/types/Map' } as SpecSchema, s);
    expect(map.schema).toEqual({ type: 'object' });
  });

  test('legacy prefixedItems is emitted as prefixItems', () => {
    const s = spec([]);
    const result = bundleRefs(
      { type: 'array', prefixedItems: [{ type: 'string' }] } as unknown as SpecSchema,
      s,
    );
    expect(result.schema).toMatchObject({ type: 'array', prefixItems: [{ type: 'string' }] });
    expect(result.schema).not.toHaveProperty('prefixedItems');
  });
});

describe('stripTsExtensions', () => {
  test('removes x-ts-* keys but keeps x-deprecated-reason', () => {
    const stripped = stripTsExtensions({
      type: 'object',
      'x-ts-type': 'Foo',
      'x-ts-package': 'lib',
      'x-deprecated-reason': 'use bar',
      properties: { a: { type: 'string', 'x-ts-type': 'string' } },
    });
    expect(stripped).toEqual({
      type: 'object',
      'x-deprecated-reason': 'use bar',
      properties: { a: { type: 'string' } },
    });
  });

  test('collapses an x-ts-function-only schema to {}', () => {
    expect(stripTsExtensions({ 'x-ts-function': true })).toEqual({});
  });
});
