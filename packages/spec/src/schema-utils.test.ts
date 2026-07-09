import { describe, expect, test } from 'bun:test';
import { flattenAnyOf, getSchemaType, resolveRef } from './schema-utils';
import type { OpenPkg, SpecSchema } from './types';

const MOCK_SPEC: OpenPkg = {
  openpkg: '0.4.0',
  meta: { name: 'test', version: '1.0.0' },
  exports: [],
  types: [
    {
      id: 'User',
      name: 'User',
      kind: 'interface',
      schema: { type: 'object', properties: { id: { type: 'string' } } },
    },
    {
      id: 'Status',
      name: 'Status',
      kind: 'type',
      schema: { type: 'string', enum: ['active', 'inactive'] },
    },
  ],
};

describe('resolveRef', () => {
  test('resolves valid $ref', () => {
    const result = resolveRef({ $ref: '#/types/User' }, MOCK_SPEC);
    expect(result).not.toBeNull();
    expect(result?.name).toBe('User');
  });

  test('returns null for missing ref', () => {
    expect(resolveRef({ $ref: '#/types/Missing' }, MOCK_SPEC)).toBeNull();
  });

  test('returns null for non-ref schema', () => {
    expect(resolveRef({ type: 'string' }, MOCK_SPEC)).toBeNull();
  });

  test('returns null for string shorthand', () => {
    expect(resolveRef('string', MOCK_SPEC)).toBeNull();
  });

  test('returns null for non-types ref', () => {
    expect(resolveRef({ $ref: '#/exports/Foo' }, MOCK_SPEC)).toBeNull();
  });
});

describe('flattenAnyOf', () => {
  test('flattens single level', () => {
    const schema: SpecSchema = { anyOf: [{ type: 'string' }, { type: 'number' }] };
    const result = flattenAnyOf(schema);
    expect(result).toHaveLength(2);
  });

  test('flattens nested anyOf', () => {
    const schema: SpecSchema = {
      anyOf: [{ type: 'string' }, { anyOf: [{ type: 'number' }, { type: 'boolean' }] }],
    };
    const result = flattenAnyOf(schema);
    expect(result).toHaveLength(3);
  });

  test('returns single-element for non-anyOf', () => {
    const result = flattenAnyOf({ type: 'string' });
    expect(result).toHaveLength(1);
  });

  test('returns single-element for string shorthand', () => {
    const result = flattenAnyOf('string');
    expect(result).toHaveLength(1);
    expect(result[0]).toBe('string');
  });
});

describe('getSchemaType', () => {
  test('string shorthand', () => {
    expect(getSchemaType('string')).toBe('string');
    expect(getSchemaType('number')).toBe('number');
  });

  test('typed schema', () => {
    expect(getSchemaType({ type: 'object' })).toBe('object');
    expect(getSchemaType({ type: 'array' })).toBe('array');
    expect(getSchemaType({ type: 'function' })).toBe('function');
  });

  test('$ref', () => {
    expect(getSchemaType({ $ref: '#/types/User' })).toBe('User');
  });

  test('combinators', () => {
    expect(getSchemaType({ anyOf: [] })).toBe('union');
    expect(getSchemaType({ allOf: [] })).toBe('intersection');
    expect(getSchemaType({ oneOf: [] })).toBe('oneOf');
  });
});
