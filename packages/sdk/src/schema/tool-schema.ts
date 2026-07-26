/**
 * toToolSchema: turn a function export into an AI tool-use parameter schema
 * for a specific provider (OpenAI strict structured outputs, or Anthropic
 * tool input_schema).
 *
 * Pipeline: pick signature → wrap params into an object schema → bundle refs
 * into $defs → apply a provider profile pass.
 */
import type { OpenPkg, SpecExport, SpecSignature } from '@openpkg-ts/spec';
import type { JSONSchema } from '../types/schema-normalizer';
import { normalizeSchema } from '../types/schema-normalizer';
import { bundleRefs, stripTsExtensions } from './ref-walker';

export type ToolSchemaProvider = 'openai-strict' | 'anthropic';

export interface ToToolSchemaOptions {
  provider: ToolSchemaProvider;
  /** Overload to use (default 0). */
  signatureIndex?: number;
}

export interface ToolSchemaResult {
  /** Export name — the tool name. */
  name: string;
  description?: string;
  /** { type:'object', properties, required, [additionalProperties], [$defs] } */
  parameters: JSONSchema;
  /** Pruned props, lowered unions, dangling refs. */
  warnings: string[];
}

/** OpenAI strict structured-outputs keyword allowlist. */
const OPENAI_ALLOWED_KEYWORDS = new Set([
  'type',
  'properties',
  'required',
  'additionalProperties',
  'items',
  'prefixItems',
  'anyOf',
  'enum',
  'const',
  'description',
  'title',
  '$ref',
  '$defs',
  'format',
]);

function isObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

/** Is this schema node an object type (explicit or via `properties`)? */
function isObjectNode(node: Record<string, unknown>): boolean {
  return node.type === 'object' || 'properties' in node;
}

/** Schema is only an x-ts-function marker → collapses to {} in JSON. */
function isFunctionOnly(schema: unknown): boolean {
  if (!isObject(schema)) return false;
  if (!('x-ts-function' in schema)) return false;
  const keys = Object.keys(schema).filter((k) => !k.startsWith('x-ts-'));
  return keys.length === 0;
}

/**
 * OpenAI strict pass: additionalProperties:false on every object, all
 * properties required, disallowed keywords dropped, function-typed props
 * pruned, oneOf→anyOf.
 */
function openAiStrict(node: unknown, warnings: string[]): unknown {
  if (Array.isArray(node)) return node.map((n) => openAiStrict(n, warnings));
  if (!isObject(node)) return node;

  // oneOf → anyOf
  const src: Record<string, unknown> = { ...node };
  if ('oneOf' in src && !('anyOf' in src)) {
    src.anyOf = src.oneOf;
    delete src.oneOf;
  }
  // allOf → merge single branch, else keep first + warn
  if (Array.isArray(src.allOf)) {
    const branches = src.allOf as unknown[];
    warnings.push('openai-strict: allOf is unsupported — using first branch');
    delete src.allOf;
    if (isObject(branches[0])) Object.assign(src, branches[0]);
  }

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(src)) {
    if (key.startsWith('x-')) continue;
    if (key === 'properties' && isObject(value)) {
      const props: Record<string, unknown> = {};
      const kept: string[] = [];
      for (const [propName, propSchema] of Object.entries(value)) {
        if (isFunctionOnly(propSchema)) {
          warnings.push(`openai-strict: pruned function-typed property "${propName}"`);
          continue;
        }
        props[propName] = openAiStrict(propSchema, warnings);
        kept.push(propName);
      }
      out.properties = props;
      // strict mode requires every property in `required`
      out.required = kept;
      continue;
    }
    if (key === 'required') continue; // rebuilt from kept properties above
    if (key === '$defs' && isObject(value)) {
      out.$defs = Object.fromEntries(
        Object.entries(value).map(([k, v]) => [k, openAiStrict(v, warnings)]),
      );
      continue;
    }
    if (!OPENAI_ALLOWED_KEYWORDS.has(key) && key !== 'anyOf' && !key.startsWith('$')) {
      warnings.push(`openai-strict: dropped unsupported keyword "${key}"`);
      continue;
    }
    out[key] = openAiStrict(value, warnings);
  }

  if (isObjectNode(out)) {
    out.type = 'object';
    if (!('properties' in out)) out.properties = {};
    if (!('required' in out)) out.required = Object.keys(out.properties as object);
    // strict mode requires additionalProperties:false everywhere — an
    // open-ended Record<K,V> value schema cannot be represented
    if (out.additionalProperties !== undefined && out.additionalProperties !== false) {
      warnings.push(
        'openai-strict: open-ended additionalProperties dropped (record types unsupported)',
      );
    }
    out.additionalProperties = false;
  }
  return out;
}

/** Anthropic pass: lenient — strip x-ts-*, prune function-typed props. */
function anthropic(node: unknown, warnings: string[]): unknown {
  if (Array.isArray(node)) return node.map((n) => anthropic(n, warnings));
  if (!isObject(node)) return node;

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (key.startsWith('x-ts-') || key === 'x-enum-members') continue;
    if (key === 'properties' && isObject(value)) {
      const props: Record<string, unknown> = {};
      const dropped = new Set<string>();
      for (const [propName, propSchema] of Object.entries(value)) {
        if (isFunctionOnly(propSchema)) {
          warnings.push(`anthropic: pruned function-typed property "${propName}"`);
          dropped.add(propName);
          continue;
        }
        props[propName] = anthropic(propSchema, warnings);
      }
      out.properties = props;
      if (Array.isArray(node.required)) {
        out.required = (node.required as string[]).filter((r) => !dropped.has(r));
      }
      continue;
    }
    if (key === 'required') continue; // handled alongside properties
    out[key] = anthropic(value, warnings);
  }
  return out;
}

/**
 * Build an AI tool-use parameter schema for a function export.
 * Throws for non-function exports (class/variable support is out of scope in v1).
 */
export function toToolSchema(
  exp: SpecExport,
  spec: OpenPkg,
  options: ToToolSchemaOptions,
): ToolSchemaResult {
  if (exp.kind !== 'function' || !exp.signatures || exp.signatures.length === 0) {
    throw new TypeError(
      `toToolSchema: export "${exp.name}" is not a function with signatures (kind: ${exp.kind})`,
    );
  }

  const sig: SpecSignature = exp.signatures[options.signatureIndex ?? 0] ?? exp.signatures[0];
  const warnings: string[] = [];

  // Wrap parameters into an object schema.
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (const param of sig.parameters ?? []) {
    let paramSchema = normalizeSchema(param.schema) as Record<string, unknown>;
    if (param.rest) {
      paramSchema = { type: 'array', items: paramSchema };
    }
    if (param.description && !paramSchema.description) {
      paramSchema.description = param.description;
    }
    properties[param.name] = paramSchema;
    if (param.required !== false) required.push(param.name);
  }

  const wrapper: JSONSchema = {
    type: 'object',
    properties,
    ...(required.length > 0 ? { required } : {}),
  };

  // Bundle refs so provider passes see $defs, not #/types/.
  const typeParameterNames = [
    ...(exp.typeParameters ?? []).map((p) => p.name),
    ...(sig.typeParameters ?? []).map((p) => p.name),
  ];
  const bundled = bundleRefs(wrapper, spec, { keepExtensions: true, typeParameterNames });
  warnings.push(...bundled.warnings);

  let parameters: JSONSchema = { ...bundled.schema };
  if (Object.keys(bundled.defs).length > 0) parameters.$defs = bundled.defs;

  if (options.provider === 'openai-strict') {
    parameters = openAiStrict(parameters, warnings) as JSONSchema;
  } else {
    parameters = stripTsExtensions(anthropic(parameters, warnings) as JSONSchema);
  }

  const description = exp.description ?? sig.description;
  return {
    name: exp.name,
    ...(description ? { description } : {}),
    parameters,
    warnings,
  };
}
