import type {
  SpecSchema,
  SpecSchemaPrimitive,
  SpecSchemaComposite,
  SpecSchemaCombinator,
  SpecSchemaRef,
} from './types';

type SchemaObj = Exclude<SpecSchema, string>;

function isObj(s: SpecSchema): s is SchemaObj {
  return typeof s === 'object' && s !== null;
}

function hasType(s: SpecSchema, t: string): boolean {
  return isObj(s) && 'type' in s && (s as { type: string }).type === t;
}

// --- Primitive guards ---

export function isStringSchema(s: SpecSchema): s is Extract<SpecSchemaPrimitive, { type: 'string' }> {
  return hasType(s, 'string');
}

export function isNumberSchema(s: SpecSchema): s is Extract<SpecSchemaPrimitive, { type: 'number' }> {
  return hasType(s, 'number');
}

export function isBooleanSchema(s: SpecSchema): s is Extract<SpecSchemaPrimitive, { type: 'boolean' }> {
  return hasType(s, 'boolean');
}

export function isIntegerSchema(s: SpecSchema): s is Extract<SpecSchemaPrimitive, { type: 'integer' }> {
  return hasType(s, 'integer');
}

export function isNullSchema(s: SpecSchema): s is Extract<SpecSchemaPrimitive, { type: 'null' }> {
  return hasType(s, 'null');
}

export function isVoidSchema(s: SpecSchema): s is Extract<SpecSchemaPrimitive, { type: 'void' }> {
  return hasType(s, 'void');
}

export function isNeverSchema(s: SpecSchema): s is Extract<SpecSchemaPrimitive, { type: 'never' }> {
  return hasType(s, 'never');
}

export function isAnySchema(s: SpecSchema): s is Extract<SpecSchemaPrimitive, { type: 'any' }> {
  return hasType(s, 'any');
}

// --- Composite guards ---

export function isObjectSchema(s: SpecSchema): s is Extract<SpecSchemaComposite, { type: 'object' }> {
  return hasType(s, 'object');
}

export function isArraySchema(s: SpecSchema): s is Extract<SpecSchemaComposite, { type: 'array' }> {
  return hasType(s, 'array');
}

export function isTupleSchema(s: SpecSchema): s is Extract<SpecSchemaComposite, { type: 'tuple' }> {
  return hasType(s, 'tuple');
}

export function isFunctionSchema(s: SpecSchema): s is Extract<SpecSchemaComposite, { type: 'function' }> {
  return hasType(s, 'function');
}

// --- Combinator guards ---

export function isAnyOfSchema(s: SpecSchema): s is Extract<SpecSchemaCombinator, { anyOf: SpecSchema[] }> {
  return isObj(s) && 'anyOf' in s && Array.isArray((s as { anyOf?: unknown }).anyOf);
}

export function isAllOfSchema(s: SpecSchema): s is Extract<SpecSchemaCombinator, { allOf: SpecSchema[] }> {
  return isObj(s) && 'allOf' in s && Array.isArray((s as { allOf?: unknown }).allOf);
}

export function isOneOfSchema(s: SpecSchema): s is Extract<SpecSchemaCombinator, { oneOf: SpecSchema[] }> {
  return isObj(s) && 'oneOf' in s && Array.isArray((s as { oneOf?: unknown }).oneOf);
}

// --- Reference guard ---

export function isRefSchema(s: SpecSchema): s is SpecSchemaRef {
  return isObj(s) && '$ref' in s && typeof (s as { $ref?: unknown }).$ref === 'string';
}
