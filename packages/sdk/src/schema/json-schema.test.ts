import { describe, expect, test } from 'bun:test';
import type { OpenPkg } from '@openpkg-ts/spec';
import { Ajv2020 } from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { toJsonSchema } from './json-schema';

const ajv = () => {
  const instance = new Ajv2020({ strict: false, allErrors: true });
  addFormats(instance);
  return instance;
};

const CYCLIC_SPEC: OpenPkg = {
  openpkg: '0.4.0',
  meta: { name: 'test' },
  exports: [{ id: 'load', name: 'load', kind: 'function', schema: { $ref: '#/types/User' } }],
  types: [
    {
      id: 'User',
      name: 'User',
      kind: 'interface',
      schema: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          createdAt: { $ref: '#/types/Date' },
          friend: { $ref: '#/types/User' },
          tags: { type: 'array', prefixItems: [{ type: 'string' }], minItems: 1, maxItems: 1 },
        },
        required: ['id'],
      },
    },
  ],
} as OpenPkg;

describe('toJsonSchema', () => {
  test('whole-spec document declares $schema and $defs and compiles under Ajv 2020', () => {
    const doc = toJsonSchema(CYCLIC_SPEC);
    expect(doc.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
    expect(doc.$defs?.User).toBeDefined();
    expect(() => ajv().compile(doc)).not.toThrow();
  });

  test('rooted document roots at the subject and bundles transitive defs', () => {
    const doc = toJsonSchema(CYCLIC_SPEC, { root: 'load' });
    // load's schema is a ref into $defs
    expect(doc.$ref).toBe('#/$defs/User');
    expect(doc.$defs?.User).toBeDefined();
    expect(() => ajv().compile(doc)).not.toThrow();
  });

  test('cyclic spec output compiles (self-ref resolves through $defs)', () => {
    const doc = toJsonSchema(CYCLIC_SPEC, { root: 'User' });
    const user = doc.$defs?.User as Record<string, Record<string, unknown>>;
    expect(user.properties.friend).toEqual({ $ref: '#/$defs/User' });
    // Date builtin inlined, not a dangling ref
    expect(user.properties.createdAt).toEqual({ type: 'string', format: 'date-time' });
    expect(() => ajv().compile(doc)).not.toThrow();
  });

  test('keepExtensions retains x-ts-*, default strips', () => {
    const spec: OpenPkg = {
      openpkg: '0.4.0',
      meta: { name: 't' },
      exports: [],
      types: [
        {
          id: 'Box',
          name: 'Box',
          kind: 'interface',
          schema: { type: 'object', 'x-ts-type': 'Box<T>' } as never,
        },
      ],
    } as OpenPkg;
    const stripped = toJsonSchema(spec, { root: 'Box' });
    expect(stripped['x-ts-type']).toBeUndefined();
    const kept = toJsonSchema(spec, { root: 'Box', keepExtensions: true });
    expect(kept['x-ts-type']).toBe('Box<T>');
  });

  test('unknown root name throws', () => {
    expect(() => toJsonSchema(CYCLIC_SPEC, { root: 'Nope' })).toThrow(/no export or type/);
  });

  test('includeSchemaField:false omits $schema', () => {
    const doc = toJsonSchema(CYCLIC_SPEC, { root: 'User', includeSchemaField: false });
    expect(doc.$schema).toBeUndefined();
  });
});
