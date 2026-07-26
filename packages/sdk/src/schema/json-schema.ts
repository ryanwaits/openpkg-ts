/**
 * toJsonSchema: lift an OpenPkg spec (or a single export/type) into a
 * standalone, self-contained JSON Schema 2020-12 document — internal
 * `#/types/Name` refs rewritten into a `#/$defs/Name` map, builtins inlined.
 *
 * The result is directly consumable by ajv, $RefParser, and OpenAPI toolchains
 * that OpenPkg's native `#/types/` convention would otherwise break.
 */

import type { OpenPkg, SpecExport, SpecType } from '@openpkg-ts/spec';
import { JSON_SCHEMA_DRAFT } from '@openpkg-ts/spec';
import { type JSONSchema, normalizeMembers, normalizeSchema } from '../types/schema-normalizer';
import { bundleRefs } from './ref-walker';

export interface ToJsonSchemaOptions {
  /** Root the document at a single export or type (by name). Default: whole-spec $defs catalogue. */
  root?: string;
  /** Keep x-ts-* keys (default false). */
  keepExtensions?: boolean;
  /** Include the $schema field (default true). */
  includeSchemaField?: boolean;
}

export interface JsonSchemaDocument extends Record<string, unknown> {
  $schema?: string;
  $defs?: Record<string, JSONSchema>;
}

/** Type parameter names declared on an export/type. */
function typeParamNames(subject: SpecExport | SpecType): string[] {
  return (subject.typeParameters ?? []).map((p) => p.name);
}

/** The schema a subject contributes: its own schema, else a members schema. */
function subjectSchema(subject: SpecExport | SpecType): JSONSchema {
  if (subject.schema) return normalizeSchema(subject.schema);
  if (subject.members && subject.members.length > 0) return normalizeMembers(subject.members);
  return {};
}

/**
 * Root a JSON Schema document at a single export or type, bundling only its
 * transitively-referenced types into `$defs`.
 */
export function exportToJsonSchema(
  subject: SpecExport | SpecType,
  spec: OpenPkg,
  options: Omit<ToJsonSchemaOptions, 'root'> = {},
): JsonSchemaDocument {
  const { keepExtensions = false, includeSchemaField = true } = options;
  const { schema, defs } = bundleRefs(subjectSchema(subject), spec, {
    keepExtensions,
    typeParameterNames: typeParamNames(subject),
  });

  const doc: JsonSchemaDocument = { ...schema };
  if (Object.keys(defs).length > 0) doc.$defs = defs;
  if (includeSchemaField) return { $schema: JSON_SCHEMA_DRAFT, ...doc };
  return doc;
}

/**
 * Lift a whole spec (or, with `root`, a single named export/type) into a
 * standalone JSON Schema 2020-12 document.
 */
export function toJsonSchema(spec: OpenPkg, options: ToJsonSchemaOptions = {}): JsonSchemaDocument {
  const { root, keepExtensions = false, includeSchemaField = true } = options;

  if (root) {
    const subject =
      spec.exports.find((e) => e.name === root) ?? (spec.types ?? []).find((t) => t.name === root);
    if (!subject) {
      throw new Error(`toJsonSchema: no export or type named "${root}"`);
    }
    return exportToJsonSchema(subject, spec, { keepExtensions, includeSchemaField });
  }

  // Whole-spec catalogue: one $defs entry per type + per schema-bearing export.
  const defs: Record<string, JSONSchema> = {};
  const mergeInto = (name: string, bundled: ReturnType<typeof bundleRefs>) => {
    for (const [key, value] of Object.entries(bundled.defs)) {
      if (!Object.hasOwn(defs, key)) defs[key] = value;
    }
    if (!Object.hasOwn(defs, name)) defs[name] = bundled.schema;
  };

  for (const type of spec.types ?? []) {
    mergeInto(
      type.name,
      bundleRefs(subjectSchema(type), spec, {
        keepExtensions,
        typeParameterNames: typeParamNames(type),
      }),
    );
  }
  for (const exp of spec.exports) {
    if (!exp.schema && !(exp.members && exp.members.length > 0)) continue;
    mergeInto(
      exp.name,
      bundleRefs(subjectSchema(exp), spec, {
        keepExtensions,
        typeParameterNames: typeParamNames(exp),
      }),
    );
  }

  const doc: JsonSchemaDocument = { $defs: defs };
  if (includeSchemaField) return { $schema: JSON_SCHEMA_DRAFT, ...doc };
  return doc;
}
