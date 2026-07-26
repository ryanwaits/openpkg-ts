/**
 * Ref-walker: shared traversal + bundling primitive for the JSON Schema adapters.
 *
 * OpenPkg's internal `$ref: '#/types/Name'` convention points at a name-keyed
 * entry in the spec's `types[]` ARRAY — not an RFC 6901-resolvable pointer.
 * `bundleRefs` rewrites those into a standard `#/$defs/Name` map so the output
 * is a self-contained JSON Schema document that off-the-shelf tooling (ajv,
 * $RefParser, OpenAPI) can resolve. Cycles are free: a visited-set means a
 * cyclic type simply points back into `$defs`.
 */
import type { OpenPkg, SpecSchema, SpecType } from '@openpkg-ts/spec';
import { type JSONSchema, normalizeMembers, normalizeSchema } from '../types/schema-normalizer';
import { BUILTIN_TYPE_SCHEMAS } from './builtins';

const INTERNAL_REF_PREFIX = '#/types/';

/** All x-ts-* / x-enum-* extension keys (x-deprecated-reason is kept). */
function isTsExtensionKey(key: string): boolean {
  return (key.startsWith('x-ts-') || key === 'x-enum-members') && key !== 'x-deprecated-reason';
}

/** Strip TypeScript-specific extension keywords from a schema tree (deep). */
export function stripTsExtensions(schema: JSONSchema): JSONSchema {
  const walk = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(walk);
    if (value && typeof value === 'object') {
      const out: Record<string, unknown> = {};
      for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
        if (isTsExtensionKey(key)) continue;
        out[key] = walk(nested);
      }
      return out;
    }
    return value;
  };
  return walk(schema) as JSONSchema;
}

/** RFC 6901 escaping for a `$defs` key used in a `#/$defs/<key>` pointer. */
function escapePointerToken(name: string): string {
  return name.replace(/~/g, '~0').replace(/\//g, '~1');
}

export interface BundleOptions {
  /** Keep x-ts-* extension keys (default false — stripped). */
  keepExtensions?: boolean;
  /** Names to treat as unresolvable generics (export/type type parameters). */
  typeParameterNames?: readonly string[];
  /** Dangling-ref strategy (default 'permissive': replace with {} + warning). */
  onUnresolved?: 'permissive' | 'error';
}

export interface BundleResult {
  /** Root schema, refs rewritten to #/$defs/<key>. */
  schema: JSONSchema;
  /** Transitively collected + rewritten type definitions. */
  defs: Record<string, JSONSchema>;
  /** Dangling refs, name collisions, pruned nodes. */
  warnings: string[];
}

/**
 * Bundle a spec schema into a self-contained JSON Schema fragment.
 *
 * Every `#/types/Name` ref becomes either an inlined builtin schema, an
 * `x-ts-type` marker (type parameters), or a `#/$defs/<key>` ref whose target
 * is collected (transitively, cycle-safe) into `defs`.
 */
export function bundleRefs(root: SpecSchema, spec: OpenPkg, options: BundleOptions = {}): BundleResult {
  const { keepExtensions = false, typeParameterNames = [], onUnresolved = 'permissive' } = options;
  const typeParams = new Set(typeParameterNames);
  const warnings: string[] = [];
  const defs: Record<string, JSONSchema> = {};
  // Map spec type name → chosen $defs key (handles sanitized-name collisions).
  const defKeyByName = new Map<string, string>();

  const lookupType = (name: string): SpecType | undefined => {
    const types = spec.types ?? [];
    return types.find((t) => t.id === name) ?? types.find((t) => t.name === name);
  };

  const assignDefKey = (name: string): string => {
    const existing = defKeyByName.get(name);
    if (existing) return existing;
    let key = escapePointerToken(name);
    if (Object.hasOwn(defs, key) || Object.values(defKeyByName).includes(key)) {
      let n = 2;
      while (Object.hasOwn(defs, `${key}_${n}`) || Object.values(defKeyByName).includes(`${key}_${n}`)) {
        n++;
      }
      warnings.push(`def key collision for "${name}" — using "${key}_${n}"`);
      key = `${key}_${n}`;
    }
    defKeyByName.set(name, key);
    return key;
  };

  const bodyOfType = (type: SpecType): JSONSchema => {
    if (type.schema) return normalizeSchema(type.schema);
    if (type.members && type.members.length > 0) return normalizeMembers(type.members);
    return {};
  };

  // Rewrite a single schema node, resolving refs. Objects/arrays recurse.
  const rewrite = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(rewrite);
    if (!node || typeof node !== 'object') return node;

    const obj = node as Record<string, unknown>;
    const ref = obj.$ref;
    if (typeof ref === 'string' && ref.startsWith(INTERNAL_REF_PREFIX)) {
      const name = ref.slice(INTERNAL_REF_PREFIX.length);
      // Sibling keys (x-ts-type-arguments, description, ...) carried on the ref.
      const siblings: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        if (key === '$ref') continue;
        siblings[key] = rewrite(value);
      }

      if (typeParams.has(name)) {
        warnings.push(`type parameter "${name}" is not an addressable schema`);
        return keepExtensions ? { ...siblings, 'x-ts-type': name } : {};
      }

      const builtin = BUILTIN_TYPE_SCHEMAS[name];
      if (builtin) {
        return { ...(builtin as Record<string, unknown>), ...(keepExtensions ? siblings : {}) };
      }

      const type = lookupType(name);
      if (!type) {
        warnings.push(`unresolved ref "${ref}"`);
        if (onUnresolved === 'error') {
          throw new Error(`bundleRefs: cannot resolve ${ref}`);
        }
        return keepExtensions ? { ...siblings, 'x-ts-type': name } : {};
      }

      const key = assignDefKey(name);
      if (!Object.hasOwn(defs, key)) {
        // Reserve before recursing so cyclic types terminate.
        defs[key] = {};
        defs[key] = rewrite(bodyOfType(type)) as JSONSchema;
      }
      const refNode: Record<string, unknown> = { $ref: `#/$defs/${key}` };
      return { ...siblings, ...refNode };
    }

    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      out[key] = rewrite(value);
    }
    return out;
  };

  let schema = rewrite(normalizeSchema(root)) as JSONSchema;
  if (!keepExtensions) {
    schema = stripTsExtensions(schema);
    for (const key of Object.keys(defs)) {
      defs[key] = stripTsExtensions(defs[key]);
    }
  }

  return { schema, defs, warnings };
}
