import { describe, expect, test } from 'bun:test';
import type { OpenPkg } from '@openpkg-ts/spec';
import { asStandardSchema } from './as-standard-schema';
import { isStandardJSONSchema } from './standard-schema';

const SPEC: OpenPkg = {
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
          age: { anyOf: [{ type: 'null' }, { type: 'number' }] },
          tags: { type: 'array', prefixItems: [{ type: 'string' }], minItems: 1, maxItems: 1 },
        },
        required: ['id'],
      },
    },
  ],
} as OpenPkg;

describe('asStandardSchema', () => {
  test('produces a valid StandardJSONSchemaV1 shape', () => {
    const std = asStandardSchema('User', SPEC);
    expect(std['~standard'].version).toBe(1);
    expect(std['~standard'].vendor).toBe('openpkg');
    expect(isStandardJSONSchema(std)).toBe(true);
  });

  test('input and output produce identical documents (static extraction)', () => {
    const std = asStandardSchema('User', SPEC);
    const input = std['~standard'].jsonSchema.input({ target: 'draft-2020-12' });
    const output = std['~standard'].jsonSchema.output({ target: 'draft-2020-12' });
    expect(input).toEqual(output);
    expect(input.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
  });

  test('draft-07 target rewrites $defs → definitions and $schema', () => {
    const cyclic: OpenPkg = {
      openpkg: '0.4.0',
      meta: { name: 't' },
      exports: [],
      types: [
        {
          id: 'Node',
          name: 'Node',
          kind: 'interface',
          schema: { type: 'object', properties: { next: { $ref: '#/types/Node' } } },
        },
      ],
    } as OpenPkg;
    const std = asStandardSchema('Node', cyclic);
    const doc = std['~standard'].jsonSchema.output({ target: 'draft-07' });
    expect(doc.$schema).toBe('http://json-schema.org/draft-07/schema#');
    expect(doc.definitions).toBeDefined();
    expect(doc.$defs).toBeUndefined();
    // ref rewritten into #/definitions/
    const defs = doc.definitions as Record<string, Record<string, Record<string, unknown>>>;
    expect(defs.Node.properties.next).toEqual({ $ref: '#/definitions/Node' });
  });

  test('openapi-3.0 target lowers null-union to nullable and drops $schema', () => {
    const std = asStandardSchema('User', SPEC);
    const doc = std['~standard'].jsonSchema.output({ target: 'openapi-3.0' });
    expect(doc.$schema).toBeUndefined();
    // asStandardSchema('User') roots at the User type — age is a top-level prop
    const age = (doc.properties as Record<string, Record<string, unknown>>).age;
    expect(age.nullable).toBe(true);
    expect(age.type).toBe('number');
    expect(age.anyOf).toBeUndefined();
  });

  test('unsupported target throws with the supported list', () => {
    const std = asStandardSchema('User', SPEC);
    expect(() => std['~standard'].jsonSchema.output({ target: 'draft-04' })).toThrow(
      /Supported: draft-2020-12/,
    );
  });

  test('string subject resolves exports then types; unknown throws', () => {
    expect(asStandardSchema('load', SPEC)['~standard'].vendor).toBe('openpkg');
    expect(() => asStandardSchema('Missing', SPEC)).toThrow(/no export or type/);
  });
});
