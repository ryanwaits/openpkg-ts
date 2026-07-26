/**
 * JSON Schema 2020-12 Normalizer
 *
 * Converts SpecSchema DSL (from static TypeScript analysis) to valid JSON Schema 2020-12.
 * This ensures consistency between static TypeScript output and runtime schema extraction.
 *
 * Type Mappings:
 * | SpecSchema                    | JSON Schema 2020-12                                |
 * |-------------------------------|---------------------------------------------------|
 * | { type: 'void' }              | { "type": "null", "x-ts-type": "void" }           |
 * | { type: 'never' }             | { "not": {} }                                     |
 * | { type: 'any' }               | {}                                                |
 * | { type: 'unknown' }           | { "x-ts-type": "unknown" }                        |
 * | { type: 'undefined' }         | { "type": "null" }                                |
 * | { type: 'bigint' }            | { "type": "integer", "x-ts-type": "bigint" }      |
 * | { type: 'symbol' }            | { "type": "string", "x-ts-type": "symbol" }       |
 * | { type: 'function', ... }     | { "x-ts-function": true, "x-ts-signatures": [...] }|
 * | { $ref, typeArguments }       | { "$ref": "...", "x-ts-type-arguments": [...] }   |
 * | { type: 'tuple', items }      | { "type": "array", "prefixItems": [...] }         |
 */

import type { SpecExport, SpecMember, SpecSchema, SpecSignature, SpecType } from '@openpkg-ts/spec';
import { JSON_SCHEMA_DRAFT } from '@openpkg-ts/spec';

// ============================================================================
// Types
// ============================================================================

/**
 * Options for schema normalization
 */
export interface NormalizeOptions {
  /** Include $schema field in output */
  includeSchemaField?: boolean;
}

/**
 * JSON Schema 2020-12 compatible output type.
 * Uses Record<string, unknown> for flexibility since JSON Schema is highly polymorphic.
 */
export type JSONSchema = Record<string, unknown>;

// ============================================================================
// Constants
// ============================================================================

// TypeScript primitive types that need special handling
// All mappings produce valid JSON Schema while preserving TS type info via x-ts-type
const TS_PRIMITIVE_NORMALIZATIONS: Record<string, () => JSONSchema> = {
  void: () => ({ type: 'null', 'x-ts-type': 'void' }),
  never: () => ({ not: {} }),
  any: () => ({}),
  unknown: () => ({ 'x-ts-type': 'unknown' }),
  undefined: () => ({ type: 'null' }),
  bigint: () => ({ type: 'integer', 'x-ts-type': 'bigint' }),
  symbol: () => ({ type: 'string', 'x-ts-type': 'symbol' }),
};

// ============================================================================
// Core Normalization Functions
// ============================================================================

/**
 * Normalize a SpecSchema to JSON Schema 2020-12.
 *
 * @param schema - The SpecSchema to normalize
 * @param options - Normalization options
 * @returns JSON Schema 2020-12 compatible schema
 */
export function normalizeSchema(schema: SpecSchema, options: NormalizeOptions = {}): JSONSchema {
  const { includeSchemaField = false } = options;

  const normalized = normalizeSchemaInternal(schema, options);

  // Add $schema field if requested
  if (includeSchemaField && typeof normalized === 'object') {
    return {
      $schema: JSON_SCHEMA_DRAFT,
      ...normalized,
    };
  }

  return normalized;
}

/**
 * Internal recursive normalization function
 */
function normalizeSchemaInternal(schema: SpecSchema, options: NormalizeOptions): JSONSchema {
  const result = normalizeSchemaDispatch(schema, options);
  // Deprecation, x-* extensions, and readOnly survive every branch — the
  // per-branch keyword lists predate them.
  if (schema && typeof schema === 'object' && !Array.isArray(schema)) {
    const s = schema as Record<string, unknown>;
    if (s.deprecated === true && result.deprecated === undefined) {
      result.deprecated = true;
    }
    if (s.readOnly === true && result.readOnly === undefined) {
      result.readOnly = true;
    }
    for (const key of Object.keys(s)) {
      if (key.startsWith('x-') && s[key] !== undefined && result[key] === undefined) {
        result[key] = s[key];
      }
    }
    // typeArguments ride any schema shape (builtin generics inline structural
    // schemas, refs keep $ref) — always surface as x-ts-type-arguments.
    if (
      Array.isArray(s.typeArguments) &&
      s.typeArguments.length > 0 &&
      result['x-ts-type-arguments'] === undefined
    ) {
      result['x-ts-type-arguments'] = (s.typeArguments as SpecSchema[]).map((arg) =>
        normalizeSchemaInternal(arg, options),
      );
    }
  }
  return result;
}

function normalizeSchemaDispatch(schema: SpecSchema, options: NormalizeOptions): JSONSchema {
  // Handle string shorthand (e.g., "string", "number")
  if (typeof schema === 'string') {
    return normalizeStringType(schema);
  }

  // Handle null/undefined input
  if (schema == null) {
    return {};
  }

  // Ensure we're working with an object
  if (typeof schema !== 'object') {
    return {};
  }

  // Handle combinators first (anyOf, allOf, oneOf)
  if ('anyOf' in schema && Array.isArray(schema.anyOf)) {
    return normalizeCombinator('anyOf', schema.anyOf, schema, options);
  }
  if ('allOf' in schema && Array.isArray(schema.allOf)) {
    return normalizeCombinator('allOf', schema.allOf, schema, options);
  }
  if ('oneOf' in schema && Array.isArray(schema.oneOf)) {
    return normalizeCombinator('oneOf', schema.oneOf, schema, options);
  }

  // Handle $ref with optional typeArguments
  if ('$ref' in schema && typeof schema.$ref === 'string') {
    return normalizeRef(schema as { $ref: string; typeArguments?: SpecSchema[] }, options);
  }

  // Handle typed schemas
  if ('type' in schema && typeof schema.type === 'string') {
    return normalizeTypedSchema(schema as Record<string, unknown> & { type: string }, options);
  }

  // Pass through other schemas (generic objects)
  // Recursively normalize any nested schemas
  return normalizeGenericObject(schema, options);
}

/**
 * Normalize string type shorthand
 */
function normalizeStringType(type: string): JSONSchema {
  // Check for special TypeScript types
  const specialNormalization = TS_PRIMITIVE_NORMALIZATIONS[type];
  if (specialNormalization) {
    return specialNormalization();
  }

  // Standard JSON Schema types pass through
  if (['string', 'number', 'boolean', 'integer', 'null', 'object', 'array'].includes(type)) {
    return { type };
  }

  // Unknown type - preserve as x-ts-type
  return { 'x-ts-type': type };
}

/**
 * Normalize a schema with explicit type field
 */
function normalizeTypedSchema(
  schema: Record<string, unknown> & { type: string },
  options: NormalizeOptions,
): JSONSchema {
  const { type } = schema;

  // Check for special TypeScript primitive types
  const specialNormalization = TS_PRIMITIVE_NORMALIZATIONS[type];
  if (specialNormalization) {
    const normalized = specialNormalization();
    // Preserve other fields like description, enum
    return mergeSchemaFields(normalized, schema, ['type']);
  }

  // Handle function types
  if (type === 'function') {
    return normalizeFunctionType(schema as Record<string, unknown> & { type: 'function' }, options);
  }

  // Handle tuple type (legacy format with type: 'tuple')
  if (type === 'tuple') {
    return normalizeTupleType(schema, options);
  }

  // Handle array type
  if (type === 'array') {
    return normalizeArrayType(schema, options);
  }

  // Handle object type
  if (type === 'object') {
    return normalizeObjectType(schema, options);
  }

  // Standard JSON Schema types - pass through with recursive normalization
  if (['string', 'number', 'boolean', 'integer', 'null'].includes(type)) {
    return normalizeStandardType(schema, options);
  }

  // Unknown type - preserve as x-ts-type with original fields
  const result: JSONSchema = { 'x-ts-type': type };
  return mergeSchemaFields(result, schema, ['type']);
}

/**
 * Normalize function types to x-ts-function format
 */
function normalizeFunctionType(
  schema: Record<string, unknown> & { type: 'function' },
  options: NormalizeOptions,
): JSONSchema {
  const result: JSONSchema = {
    'x-ts-function': true,
  };

  // Normalize signatures if present
  if ('signatures' in schema && Array.isArray(schema.signatures)) {
    result['x-ts-signatures'] = (schema.signatures as SpecSignature[]).map((sig) =>
      normalizeSignature(sig, options),
    );
  }

  // Preserve description
  if ('description' in schema && schema.description) {
    result.description = schema.description;
  }

  return result;
}

/**
 * Normalize a function signature
 */
function normalizeSignature(
  signature: SpecSignature,
  options: NormalizeOptions,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  if (signature.parameters) {
    result.parameters = signature.parameters.map((param) => ({
      name: param.name,
      schema: normalizeSchemaInternal(param.schema, options),
      ...(param.required !== undefined ? { required: param.required } : {}),
      ...(param.description ? { description: param.description } : {}),
      ...(param.default !== undefined ? { default: param.default } : {}),
      ...(param.rest ? { rest: param.rest } : {}),
    }));
  }

  if (signature.returns) {
    result.returns = {
      schema: normalizeSchemaInternal(signature.returns.schema, options),
      ...(signature.returns.description ? { description: signature.returns.description } : {}),
    };
  }

  if (signature.description) {
    result.description = signature.description;
  }

  if (signature.typeParameters) {
    result.typeParameters = signature.typeParameters;
  }

  return result;
}

/**
 * Normalize tuple type to JSON Schema 2020-12 format
 * Uses prefixItems instead of items array
 */
function normalizeTupleType(
  schema: Record<string, unknown>,
  options: NormalizeOptions,
): JSONSchema {
  const result: JSONSchema = { type: 'array' };

  // Accept both the 2020-12 keyword and the legacy misspelling emitted by
  // spec <= 0.4.0 tooling; always emit prefixItems
  const prefix = Array.isArray(schema.prefixItems)
    ? schema.prefixItems
    : Array.isArray(schema.prefixedItems)
      ? schema.prefixedItems
      : undefined;

  if (prefix) {
    result.prefixItems = (prefix as SpecSchema[]).map((item) =>
      normalizeSchemaInternal(item, options),
    );
  } else if ('items' in schema && Array.isArray(schema.items)) {
    // Legacy 'items' array format for tuples
    result.prefixItems = (schema.items as SpecSchema[]).map((item) =>
      normalizeSchemaInternal(item, options),
    );
    result.minItems = schema.items.length;
    result.maxItems = schema.items.length;
  }

  // Preserve minItems/maxItems if explicitly set
  if ('minItems' in schema && typeof schema.minItems === 'number') {
    result.minItems = schema.minItems;
  }
  if ('maxItems' in schema && typeof schema.maxItems === 'number') {
    result.maxItems = schema.maxItems;
  }

  // Preserve description
  if ('description' in schema && schema.description) {
    result.description = schema.description;
  }

  return result;
}

/**
 * Normalize array type
 */
function normalizeArrayType(
  schema: Record<string, unknown>,
  options: NormalizeOptions,
): JSONSchema {
  const result: JSONSchema = { type: 'array' };

  // Normalize items if present (and not an array - that's tuple format)
  if ('items' in schema && schema.items && !Array.isArray(schema.items)) {
    result.items = normalizeSchemaInternal(schema.items as SpecSchema, options);
  }

  // Handle tuple prefixes (accept legacy misspelling on input, emit prefixItems)
  const arrayPrefix = Array.isArray(schema.prefixItems)
    ? schema.prefixItems
    : Array.isArray(schema.prefixedItems)
      ? schema.prefixedItems
      : undefined;
  if (arrayPrefix) {
    result.prefixItems = (arrayPrefix as SpecSchema[]).map((item) =>
      normalizeSchemaInternal(item, options),
    );
  }

  // Preserve constraints
  if ('minItems' in schema && typeof schema.minItems === 'number') {
    result.minItems = schema.minItems;
  }
  if ('maxItems' in schema && typeof schema.maxItems === 'number') {
    result.maxItems = schema.maxItems;
  }

  // Standard array keywords — pass through / normalize
  if (schema.uniqueItems === true) {
    result.uniqueItems = true;
  }
  if (schema.contains && typeof schema.contains === 'object') {
    result.contains = normalizeSchemaInternal(schema.contains as SpecSchema, options);
  }
  for (const keyword of ['title', 'default']) {
    if (keyword in schema && schema[keyword] !== undefined) {
      result[keyword] = schema[keyword];
    }
  }

  // Preserve description
  if ('description' in schema && schema.description) {
    result.description = schema.description;
  }

  return result;
}

/**
 * Normalize object type
 */
function normalizeObjectType(
  schema: Record<string, unknown>,
  options: NormalizeOptions,
): JSONSchema {
  const result: JSONSchema = { type: 'object' };

  // Normalize properties
  if ('properties' in schema && schema.properties) {
    const properties = schema.properties as Record<string, SpecSchema>;
    result.properties = Object.fromEntries(
      Object.entries(properties).map(([key, value]) => [
        key,
        normalizeSchemaInternal(value, options),
      ]),
    );
  }

  // Preserve required array
  if ('required' in schema && Array.isArray(schema.required)) {
    result.required = schema.required;
  }

  // Normalize additionalProperties
  if ('additionalProperties' in schema) {
    if (typeof schema.additionalProperties === 'boolean') {
      result.additionalProperties = schema.additionalProperties;
    } else if (schema.additionalProperties) {
      result.additionalProperties = normalizeSchemaInternal(
        schema.additionalProperties as SpecSchema,
        options,
      );
    }
  }

  // Standard object keywords that carry schema values — normalize recursively
  for (const keyword of ['patternProperties', '$defs'] as const) {
    const value = schema[keyword];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[keyword] = Object.fromEntries(
        Object.entries(value as Record<string, SpecSchema>).map(([key, nested]) => [
          key,
          normalizeSchemaInternal(nested, options),
        ]),
      );
    }
  }
  if (schema.propertyNames && typeof schema.propertyNames === 'object') {
    result.propertyNames = normalizeSchemaInternal(schema.propertyNames as SpecSchema, options);
  }

  // Standard scalar keywords — pass through
  for (const keyword of ['title', 'default', 'examples', 'minProperties', 'maxProperties']) {
    if (keyword in schema && schema[keyword] !== undefined) {
      result[keyword] = schema[keyword];
    }
  }

  // Preserve description
  if ('description' in schema && schema.description) {
    result.description = schema.description;
  }

  return result;
}

/**
 * Normalize standard JSON Schema types (string, number, boolean, integer, null)
 */
function normalizeStandardType(
  schema: Record<string, unknown> & { type: string },
  options: NormalizeOptions,
): JSONSchema {
  const result: JSONSchema = { type: schema.type };

  // Preserve common validation keywords
  const validationKeywords = [
    'enum',
    'const',
    'format',
    'pattern',
    'minimum',
    'maximum',
    'exclusiveMinimum',
    'exclusiveMaximum',
    'multipleOf',
    'minLength',
    'maxLength',
    'description',
    'default',
    'examples',
    'title',
  ];

  for (const keyword of validationKeywords) {
    if (keyword in schema && (schema as Record<string, unknown>)[keyword] !== undefined) {
      result[keyword] = (schema as Record<string, unknown>)[keyword];
    }
  }

  // Preserve all x-* extensions (x-ts-* TypeScript metadata, x-enum-members, …)
  for (const key of Object.keys(schema)) {
    if (key.startsWith('x-') && schema[key] !== undefined) {
      // Recursively normalize the value if it's a schema-like object
      const value = schema[key];
      if (isSchemaLike(value)) {
        result[key] = normalizeSchemaInternal(value as SpecSchema, options);
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        // For objects like x-ts-type-predicate which contain schema fields
        result[key] = normalizeGenericObject(value as Record<string, unknown>, options);
      } else {
        result[key] = value;
      }
    }
  }

  return result;
}

/**
 * Normalize $ref with optional typeArguments
 */
function normalizeRef(
  schema: { $ref: string; typeArguments?: SpecSchema[]; [key: string]: unknown },
  options: NormalizeOptions,
): JSONSchema {
  const result: JSONSchema = { $ref: schema.$ref };

  // Convert typeArguments to x-ts-type-arguments extension
  if (schema.typeArguments && schema.typeArguments.length > 0) {
    result['x-ts-type-arguments'] = schema.typeArguments.map((arg) =>
      normalizeSchemaInternal(arg, options),
    );
  }

  // Preserve x-ts-package and other x-ts-* extensions
  for (const key of Object.keys(schema)) {
    if (key.startsWith('x-ts-') && schema[key] !== undefined) {
      result[key] = schema[key];
    }
  }

  return result;
}

/**
 * Normalize combinator schemas (anyOf, allOf, oneOf)
 */
function normalizeCombinator(
  keyword: 'anyOf' | 'allOf' | 'oneOf',
  schemas: SpecSchema[],
  originalSchema: Record<string, unknown>,
  options: NormalizeOptions,
): JSONSchema {
  let branches = schemas.map((s) => normalizeSchemaInternal(s, options));

  // Dedupe structurally-identical anyOf/oneOf branches — `string | null |
  // undefined` lowers undefined→null and null→null, yielding double null.
  if (keyword !== 'allOf') {
    const seen = new Set<string>();
    branches = branches.filter((b) => {
      const key = JSON.stringify(b);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (branches.length === 1) {
      const single = { ...branches[0] };
      if ('description' in originalSchema && originalSchema.description && !single.description) {
        single.description = originalSchema.description;
      }
      return single;
    }
  }

  const result: JSONSchema = { [keyword]: branches };

  // Preserve discriminator for anyOf/oneOf
  if (
    (keyword === 'anyOf' || keyword === 'oneOf') &&
    'discriminator' in originalSchema &&
    originalSchema.discriminator
  ) {
    result.discriminator = originalSchema.discriminator;
  }

  // Preserve description
  if ('description' in originalSchema && originalSchema.description) {
    result.description = originalSchema.description;
  }

  return result;
}

/**
 * Normalize a generic object schema, recursively normalizing nested schemas
 */
function normalizeGenericObject(
  schema: Record<string, unknown>,
  options: NormalizeOptions,
): JSONSchema {
  const result: JSONSchema = {};

  for (const [key, value] of Object.entries(schema)) {
    if (value == null) continue;

    // Recursively normalize values that look like schemas
    if (isSchemaLike(value)) {
      result[key] = normalizeSchemaInternal(value as SpecSchema, options);
    } else if (Array.isArray(value)) {
      // Recursively normalize arrays of schemas
      result[key] = value.map((item) =>
        isSchemaLike(item) ? normalizeSchemaInternal(item as SpecSchema, options) : item,
      );
    } else if (typeof value === 'object') {
      // Recursively normalize nested objects
      result[key] = normalizeGenericObject(value as Record<string, unknown>, options);
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Check if a value looks like a schema (has type, $ref, or combinator)
 */
function isSchemaLike(value: unknown): boolean {
  if (typeof value !== 'object' || value == null) return false;
  if (typeof value === 'string') return true;

  const obj = value as Record<string, unknown>;
  return (
    'type' in obj ||
    '$ref' in obj ||
    'anyOf' in obj ||
    'allOf' in obj ||
    'oneOf' in obj ||
    'properties' in obj ||
    'items' in obj ||
    'prefixItems' in obj ||
    'prefixedItems' in obj
  );
}

/**
 * Merge additional fields from source schema, excluding specified keys
 */
function mergeSchemaFields(
  target: JSONSchema,
  source: SpecSchema,
  excludeKeys: string[],
): JSONSchema {
  if (typeof source !== 'object' || source == null) {
    return target;
  }

  const excludeSet = new Set(excludeKeys);
  const result = { ...target };

  for (const [key, value] of Object.entries(source)) {
    if (!excludeSet.has(key) && value !== undefined) {
      // Only copy if not already in target
      if (!(key in result)) {
        result[key] = value;
      }
    }
  }

  return result;
}

// ============================================================================
// High-level Normalization Functions
// ============================================================================

/**
 * Normalize a SpecExport, normalizing its schema and nested schemas.
 *
 * For interfaces and classes, this function will:
 * 1. Normalize any existing schema
 * 2. Normalize member schemas
 * 3. Generate a JSON Schema from members if members exist (populates `schema` field)
 */
/**
 * True when an export's schema came verbatim from a runtime Standard Schema
 * vendor (Zod, Valibot, ...) via hybrid extraction. Vendor output is already
 * valid JSON Schema — re-normalizing it through the static-DSL whitelists
 * strips keywords the DSL never emits ($defs, patternProperties, ...).
 */
function isVendorSchemaExport(exp: SpecExport): boolean {
  return !!exp.tags?.some((t) => t.name === 'schema-source' && t.text === 'standard-json-schema');
}

export function normalizeExport(exp: SpecExport, options: NormalizeOptions = {}): SpecExport {
  const result: SpecExport = { ...exp };
  const vendorSchema = isVendorSchemaExport(exp);

  // Normalize top-level schema if it exists — but keep vendor-provided
  // JSON Schema byte-for-byte
  if (exp.schema && !vendorSchema) {
    result.schema = normalizeSchema(exp.schema, options) as SpecSchema;
  }

  // Normalize signatures
  if (exp.signatures) {
    result.signatures = exp.signatures.map((sig) => normalizeSignatureSpec(sig, options));
  }

  // Normalize members
  if (exp.members) {
    result.members = exp.members.map((member) => normalizeMember(member, options));
  }

  // For interfaces and classes, generate schema from members
  // This populates the `schema` field with a JSON Schema object
  if (
    !vendorSchema &&
    shouldGenerateMembersSchema(exp.kind) &&
    exp.members &&
    exp.members.length > 0
  ) {
    result.schema = normalizeMembers(exp.members, options) as SpecSchema;
  }

  return result;
}

/**
 * Normalize a SpecType, normalizing its schema and nested schemas.
 *
 * For interfaces and classes, this function will:
 * 1. Normalize any existing schema
 * 2. Normalize member schemas
 * 3. Generate a JSON Schema from members if members exist (populates `schema` field)
 */
export function normalizeType(type: SpecType, options: NormalizeOptions = {}): SpecType {
  const result: SpecType = { ...type };

  // Normalize top-level schema if it exists
  if (type.schema) {
    result.schema = normalizeSchema(type.schema, options) as SpecSchema;
  }

  // Normalize members
  if (type.members) {
    result.members = type.members.map((member) => normalizeMember(member, options));
  }

  // For interfaces and classes, generate schema from members
  // This populates the `schema` field with a JSON Schema object
  if (shouldGenerateMembersSchema(type.kind) && type.members && type.members.length > 0) {
    result.schema = normalizeMembers(type.members, options) as SpecSchema;
  }

  return result;
}

/**
 * Check if a kind should have its schema generated from members
 */
function shouldGenerateMembersSchema(kind: string): boolean {
  return kind === 'interface' || kind === 'class';
}

/**
 * Normalize a SpecSignature
 */
function normalizeSignatureSpec(
  signature: SpecSignature,
  options: NormalizeOptions,
): SpecSignature {
  const result: SpecSignature = { ...signature };

  if (signature.parameters) {
    result.parameters = signature.parameters.map((param) => ({
      ...param,
      schema: normalizeSchema(param.schema, options) as SpecSchema,
    }));
  }

  if (signature.returns) {
    result.returns = {
      ...signature.returns,
      schema: normalizeSchema(signature.returns.schema, options) as SpecSchema,
    };
  }

  return result;
}

/**
 * Normalize a SpecMember
 */
function normalizeMember(member: SpecMember, options: NormalizeOptions): SpecMember {
  const result: SpecMember = { ...member };

  if (member.schema) {
    result.schema = normalizeSchema(member.schema, options) as SpecSchema;
  }

  if (member.signatures) {
    result.signatures = member.signatures.map((sig) => normalizeSignatureSpec(sig, options));
  }

  return result;
}

// ============================================================================
// Members Normalization (Phase 2)
// ============================================================================

/**
 * Convert a members array to JSON Schema properties format.
 *
 * This function transforms the SpecMember[] array representation used by
 * interfaces/classes into a JSON Schema 2020-12 object schema with properties,
 * required array, and additionalProperties.
 *
 * Member Kind Mappings:
 * | Member Kind        | JSON Schema Output                                    |
 * |--------------------|-------------------------------------------------------|
 * | property           | Direct schema in properties                           |
 * | method             | { "x-ts-function": true, "x-ts-signatures": [...] }   |
 * | getter             | Schema in properties (read-only via extension)        |
 * | setter             | Schema in properties (write-only via extension)       |
 * | index              | additionalProperties schema                           |
 *
 * @param members - The members array from an interface/class
 * @param options - Normalization options
 * @returns JSON Schema object with properties, required, and additionalProperties
 */
export function normalizeMembers(
  members: SpecMember[],
  options: NormalizeOptions = {},
): JSONSchema {
  const properties: Record<string, JSONSchema> = {};
  const required: string[] = [];
  let additionalProperties: JSONSchema | boolean | undefined;
  let numberIndexSchema: JSONSchema | undefined;

  for (const member of members) {
    const { name, kind } = member;

    // Handle index signatures → additionalProperties (string keys) or
    // patternProperties over digit keys (number keys). serializeIndexSignature
    // names members "[string]"/"[number]".
    // Supports both 'index' and 'index-signature' kind names
    if (kind === 'index' || kind === 'index-signature') {
      if (name === '[number]') {
        numberIndexSchema = normalizeMemberToSchema(member, options);
      } else {
        additionalProperties = normalizeMemberToSchema(member, options);
      }
      continue;
    }

    // Skip members without names (shouldn't happen but be safe)
    if (!name) continue;

    // Convert member to schema
    const memberSchema = normalizeMemberToSchema(member, options);
    properties[name] = memberSchema;

    // Build required array - non-optional members
    if (!isOptionalMember(member)) {
      required.push(name);
    }
  }

  const result: JSONSchema = {
    type: 'object',
    properties,
  };

  // Only include required if non-empty
  if (required.length > 0) {
    result.required = required;
  }

  // Include additionalProperties if we found index signatures
  if (additionalProperties !== undefined) {
    result.additionalProperties = additionalProperties;
  }
  if (numberIndexSchema !== undefined) {
    result.patternProperties = { '^\\d+$': numberIndexSchema };
    result['x-ts-index-key'] = 'number';
  }

  return result;
}

/**
 * Convert a single member to its JSON Schema representation
 */
/** Doc fields a member contributes to its property schema (description + deprecation). */
function memberDocExtras(member: SpecMember): JSONSchema {
  const extras: JSONSchema = {};
  if (member.description) {
    extras.description = member.description;
  }
  if (member.flags?.readonly === true) {
    extras.readOnly = true;
  }
  if (member.deprecated) {
    extras.deprecated = true;
    const reason =
      member.deprecationReason ?? member.tags?.find((t) => t.name === 'deprecated')?.text;
    if (reason?.trim()) {
      extras['x-deprecated-reason'] = reason;
    }
  }
  return extras;
}

function normalizeMemberToSchema(member: SpecMember, options: NormalizeOptions): JSONSchema {
  const { kind, schema, signatures } = member;

  // Method members → x-ts-function schema
  // Also handle call-signature for callable interfaces
  if (kind === 'method' || kind === 'call-signature') {
    return normalizeMethodMember(member, options);
  }

  // Getter members - include x-ts-accessor extension
  if (kind === 'getter') {
    const baseSchema = schema ? normalizeSchemaInternal(schema, options) : {};
    return {
      ...baseSchema,
      'x-ts-accessor': 'getter',
      ...memberDocExtras(member),
    };
  }

  // Setter members - include x-ts-accessor extension
  if (kind === 'setter') {
    const baseSchema = schema ? normalizeSchemaInternal(schema, options) : {};
    return {
      ...baseSchema,
      'x-ts-accessor': 'setter',
      ...memberDocExtras(member),
    };
  }

  // Index signature members - just return the schema for additionalProperties
  // Supports both 'index' and 'index-signature' kind names
  if (kind === 'index' || kind === 'index-signature') {
    // Handle both direct schema and wrapped object schema from interfaces.ts
    if (schema && typeof schema === 'object' && 'additionalProperties' in schema) {
      // interfaces.ts wraps in { type: 'object', additionalProperties: ... }
      return normalizeSchemaInternal(schema.additionalProperties as SpecSchema, options);
    }
    return schema ? normalizeSchemaInternal(schema, options) : {};
  }

  // Property members (default case)
  // May also have signatures if it's a callable property
  if (signatures && signatures.length > 0) {
    // Callable property - treat like a method
    return normalizeMethodMember(member, options);
  }

  // Regular property
  const baseSchema = schema ? normalizeSchemaInternal(schema, options) : {};
  const extras = memberDocExtras(member);

  return Object.keys(extras).length > 0 ? { ...baseSchema, ...extras } : baseSchema;
}

/**
 * Normalize a method member to x-ts-function schema
 */
function normalizeMethodMember(member: SpecMember, options: NormalizeOptions): JSONSchema {
  const result: JSONSchema = {
    'x-ts-function': true,
  };

  // Mirror declaration form on the flattened schema layer.
  if (member.flags?.methodSyntax === true) {
    result['x-ts-method'] = true;
  }

  // Carry the member's checker-rendered type text onto the flattened schema.
  const memberTypeText =
    member.schema && typeof member.schema === 'object'
      ? (member.schema as Record<string, unknown>)['x-ts-type']
      : undefined;
  if (typeof memberTypeText === 'string') {
    result['x-ts-type'] = memberTypeText;
  }

  if (member.signatures && member.signatures.length > 0) {
    result['x-ts-signatures'] = member.signatures.map((sig) => normalizeSignature(sig, options));
  }

  Object.assign(result, memberDocExtras(member));

  return result;
}

/**
 * Determine if a member is optional
 */
function isOptionalMember(member: SpecMember): boolean {
  // Check flags for optional indicator
  if (member.flags?.optional === true) {
    return true;
  }

  // Check if name ends with '?' (some parsers encode optionality this way)
  if (member.name?.endsWith('?')) {
    return true;
  }

  // Getters without setters could be considered non-writable but not optional
  // Setters without getters could be considered write-only but not optional
  // For now, accessors are not inherently optional

  return false;
}
