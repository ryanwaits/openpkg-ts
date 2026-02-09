import { describe, expect, test } from 'bun:test';
import {
  isStringSchema,
  isNumberSchema,
  isBooleanSchema,
  isIntegerSchema,
  isNullSchema,
  isVoidSchema,
  isNeverSchema,
  isAnySchema,
  isObjectSchema,
  isArraySchema,
  isTupleSchema,
  isFunctionSchema,
  isAnyOfSchema,
  isAllOfSchema,
  isOneOfSchema,
  isRefSchema,
} from './guards';
import type { SpecSchema } from './types';

describe('primitive guards', () => {
  test('isStringSchema', () => {
    expect(isStringSchema({ type: 'string' })).toBe(true);
    expect(isStringSchema({ type: 'string', enum: ['a', 'b'] })).toBe(true);
    expect(isStringSchema({ type: 'number' })).toBe(false);
    expect(isStringSchema('string')).toBe(false);
  });

  test('isNumberSchema', () => {
    expect(isNumberSchema({ type: 'number' })).toBe(true);
    expect(isNumberSchema({ type: 'number', enum: [1, 2] })).toBe(true);
    expect(isNumberSchema({ type: 'string' })).toBe(false);
  });

  test('isBooleanSchema', () => {
    expect(isBooleanSchema({ type: 'boolean' })).toBe(true);
    expect(isBooleanSchema({ type: 'string' })).toBe(false);
  });

  test('isIntegerSchema', () => {
    expect(isIntegerSchema({ type: 'integer' })).toBe(true);
    expect(isIntegerSchema({ type: 'number' })).toBe(false);
  });

  test('isNullSchema', () => {
    expect(isNullSchema({ type: 'null' })).toBe(true);
    expect(isNullSchema({ type: 'undefined' })).toBe(false);
  });

  test('isVoidSchema', () => {
    expect(isVoidSchema({ type: 'void' })).toBe(true);
  });

  test('isNeverSchema', () => {
    expect(isNeverSchema({ type: 'never' })).toBe(true);
  });

  test('isAnySchema', () => {
    expect(isAnySchema({ type: 'any' })).toBe(true);
  });
});

describe('composite guards', () => {
  test('isObjectSchema', () => {
    expect(isObjectSchema({ type: 'object', properties: { a: { type: 'string' } } })).toBe(true);
    expect(isObjectSchema({ type: 'object' })).toBe(true);
    expect(isObjectSchema({ type: 'array' })).toBe(false);
  });

  test('isArraySchema', () => {
    expect(isArraySchema({ type: 'array', items: { type: 'string' } })).toBe(true);
    expect(isArraySchema({ type: 'array' })).toBe(true);
    expect(isArraySchema({ type: 'tuple', items: [] })).toBe(false);
  });

  test('isTupleSchema', () => {
    expect(isTupleSchema({ type: 'tuple', items: [{ type: 'string' }, { type: 'number' }] })).toBe(true);
    expect(isTupleSchema({ type: 'array' })).toBe(false);
  });

  test('isFunctionSchema', () => {
    expect(isFunctionSchema({ type: 'function', signatures: [] })).toBe(true);
    expect(isFunctionSchema({ type: 'object' })).toBe(false);
  });
});

describe('combinator guards', () => {
  test('isAnyOfSchema', () => {
    expect(isAnyOfSchema({ anyOf: [{ type: 'string' }, { type: 'number' }] })).toBe(true);
    expect(isAnyOfSchema({ allOf: [] })).toBe(false);
    expect(isAnyOfSchema({ type: 'string' })).toBe(false);
  });

  test('isAllOfSchema', () => {
    expect(isAllOfSchema({ allOf: [{ type: 'string' }] })).toBe(true);
    expect(isAllOfSchema({ anyOf: [] })).toBe(false);
  });

  test('isOneOfSchema', () => {
    expect(isOneOfSchema({ oneOf: [{ type: 'string' }] })).toBe(true);
    expect(isOneOfSchema({ anyOf: [] })).toBe(false);
  });
});

describe('reference guard', () => {
  test('isRefSchema', () => {
    expect(isRefSchema({ $ref: '#/types/Foo' })).toBe(true);
    expect(isRefSchema({ $ref: '#/types/Foo', typeArguments: [{ type: 'string' }] })).toBe(true);
    expect(isRefSchema({ type: 'string' })).toBe(false);
    expect(isRefSchema('string')).toBe(false);
  });
});

describe('string shorthand', () => {
  test('all guards reject string shorthand', () => {
    const s: SpecSchema = 'string';
    expect(isStringSchema(s)).toBe(false);
    expect(isNumberSchema(s)).toBe(false);
    expect(isObjectSchema(s)).toBe(false);
    expect(isRefSchema(s)).toBe(false);
    expect(isAnyOfSchema(s)).toBe(false);
  });
});
