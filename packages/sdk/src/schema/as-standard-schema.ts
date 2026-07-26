/**
 * asStandardSchema: wrap an OpenPkg-extracted export/type as a
 * StandardJSONSchemaV1 producer, so OpenPkg output is consumable by every
 * Standard Schema JSON Schema integrator (xsAI, GQLoom, restate, ...).
 *
 * Since static extraction has no runtime transform pipeline, `input` and
 * `output` return the same schema. The `target` option selects the JSON Schema
 * dialect; unsupported targets throw per the spec's error contract.
 *
 * @see https://standardschema.dev/json-schema
 */
import type { OpenPkg, SpecExport, SpecType } from '@openpkg-ts/spec';
import type { JSONSchema } from '../types/schema-normalizer';
import { exportToJsonSchema, type JsonSchemaDocument } from './json-schema';
import type { StandardJSONSchemaOptions, StandardJSONSchemaV1 } from './standard-schema';

const DRAFT_07_URL = 'http://json-schema.org/draft-07/schema#';

export interface AsStandardSchemaOptions {
  keepExtensions?: boolean;
}

/** Deep-rewrite every `#/$defs/` pointer to `#/definitions/`. */
function rewriteDefsPointers(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(rewriteDefsPointers);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (key === '$ref' && typeof nested === 'string') {
        out.$ref = nested.replace('#/$defs/', '#/definitions/');
      } else {
        out[key] = rewriteDefsPointers(nested);
      }
    }
    return out;
  }
  return value;
}

/** 2020-12 → draft-07: $defs→definitions, prefixItems→items array, draft-07 $schema. */
function downlevelToDraft07(doc: JsonSchemaDocument): JSONSchema {
  const convert = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(convert);
    if (value && typeof value === 'object') {
      const obj = value as Record<string, unknown>;
      const out: Record<string, unknown> = {};
      for (const [key, nested] of Object.entries(obj)) {
        if (key === '$defs') {
          out.definitions = convert(nested);
        } else if (key === 'prefixItems' && Array.isArray(nested)) {
          // draft-07 tuples use an `items` array
          out.items = convert(nested);
        } else {
          out[key] = convert(nested);
        }
      }
      return out;
    }
    return value;
  };
  const converted = rewriteDefsPointers(convert(doc)) as Record<string, unknown>;
  converted.$schema = DRAFT_07_URL;
  return converted as JSONSchema;
}

/** 2020-12 → OpenAPI 3.0: null-union→nullable, const→enum, drop $schema. */
function downlevelToOpenApi30(doc: JsonSchemaDocument): JSONSchema {
  const convert = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(convert);
    if (!value || typeof value !== 'object') return value;
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};

    // anyOf:[{type:'null'}, X] → X + nullable:true
    if (Array.isArray(obj.anyOf)) {
      const branches = obj.anyOf as Record<string, unknown>[];
      const nulls = branches.filter((b) => b && b.type === 'null');
      const rest = branches.filter((b) => !(b && b.type === 'null'));
      if (nulls.length > 0 && rest.length === 1) {
        Object.assign(out, convert(rest[0]) as Record<string, unknown>);
        out.nullable = true;
        for (const [key, nested] of Object.entries(obj)) {
          if (key !== 'anyOf') out[key] = convert(nested);
        }
        return out;
      }
    }

    for (const [key, nested] of Object.entries(obj)) {
      if (key === '$schema') continue;
      if (key === '$defs') {
        out.definitions = convert(nested);
      } else if (key === 'const') {
        out.enum = [nested];
      } else {
        out[key] = convert(nested);
      }
    }
    return out;
  };
  return rewriteDefsPointers(convert(doc)) as JSONSchema;
}

/**
 * Wrap an export, type, or named subject as a StandardJSONSchemaV1 producer.
 * A string subject is resolved against the spec (exports first, then types).
 */
export function asStandardSchema(
  subject: SpecExport | SpecType | string,
  spec: OpenPkg,
  options: AsStandardSchemaOptions = {},
): StandardJSONSchemaV1 {
  const resolved =
    typeof subject === 'string'
      ? (spec.exports.find((e) => e.name === subject) ??
        (spec.types ?? []).find((t) => t.name === subject))
      : subject;
  if (!resolved) {
    throw new Error(`asStandardSchema: no export or type named "${subject as string}"`);
  }

  const cache = new Map<string, Record<string, unknown>>();
  const build = (opts: StandardJSONSchemaOptions): Record<string, unknown> => {
    const target = opts.target;
    const cached = cache.get(target);
    if (cached) return cached;

    const base = exportToJsonSchema(resolved, spec, {
      keepExtensions: options.keepExtensions,
      includeSchemaField: true,
    });

    let result: Record<string, unknown>;
    switch (target) {
      case 'draft-2020-12':
        result = base;
        break;
      case 'draft-07':
        result = downlevelToDraft07(base);
        break;
      case 'openapi-3.0':
        result = downlevelToOpenApi30(base);
        break;
      default:
        throw new Error(
          `asStandardSchema: unsupported target "${target}". Supported: draft-2020-12, draft-07, openapi-3.0`,
        );
    }
    cache.set(target, result);
    return result;
  };

  return {
    '~standard': {
      version: 1,
      vendor: 'openpkg',
      jsonSchema: {
        input: build,
        output: build,
      },
    },
  };
}
