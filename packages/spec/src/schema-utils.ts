import { isAnyOfSchema, isRefSchema } from './guards';
import type { OpenPkg, SpecSchema, SpecType } from './types';

/**
 * Resolve a $ref schema to the referenced SpecType.
 * Returns null if the ref can't be resolved.
 */
export function resolveRef(schema: SpecSchema, spec: OpenPkg): SpecType | null {
  if (!isRefSchema(schema)) return null;
  const prefix = '#/types/';
  if (!schema.$ref.startsWith(prefix)) return null;
  const name = schema.$ref.slice(prefix.length);
  return spec.types?.find((t) => t.name === name) ?? null;
}

/**
 * Flatten nested anyOf into a single array of schemas.
 * Non-anyOf schemas return as a single-element array.
 */
export function flattenAnyOf(schema: SpecSchema): SpecSchema[] {
  if (!isAnyOfSchema(schema)) return [schema];
  const result: SpecSchema[] = [];
  for (const s of schema.anyOf) {
    if (isAnyOfSchema(s)) {
      result.push(...flattenAnyOf(s));
    } else {
      result.push(s);
    }
  }
  return result;
}

/**
 * Get a human-readable type string from a schema.
 */
export function getSchemaType(schema: SpecSchema): string {
  if (typeof schema === 'string') return schema;
  if ('$ref' in schema && typeof (schema as { $ref: unknown }).$ref === 'string') {
    const ref = (schema as { $ref: string }).$ref;
    const prefix = '#/types/';
    return ref.startsWith(prefix) ? ref.slice(prefix.length) : ref;
  }
  if ('anyOf' in schema) return 'union';
  if ('allOf' in schema) return 'intersection';
  if ('oneOf' in schema) return 'oneOf';
  if ('type' in schema && typeof (schema as { type: unknown }).type === 'string') {
    return (schema as { type: string }).type;
  }
  return 'unknown';
}
