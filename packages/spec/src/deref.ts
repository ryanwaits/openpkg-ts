import type { OpenPkg, SpecSchema, SpecType } from './types';

type SpecLike = Record<string, unknown>;

type TypeLookup = Map<string, SpecType>;

export function dereference(spec: OpenPkg): OpenPkg {
  const clone: OpenPkg = structuredClone(spec);
  const typeLookup = buildTypeLookup(clone.types);

  const visit = (value: unknown, seen: Set<string>): unknown => {
    if (Array.isArray(value)) {
      return value.map((item) => visit(item, new Set(seen)));
    }

    if (value && typeof value === 'object') {
      const record = value as SpecLike;
      const ref = readTypeRef(record);
      if (ref) {
        const resolved = resolveTypeRef(ref, typeLookup, seen);
        // Ref siblings (x-ts-type-arguments, x-ts-package, description, ...)
        // carry information the target schema does not — preserve them, but
        // never let a stale sibling override a key the target defines.
        const siblings: SpecLike = {};
        for (const [key, nested] of Object.entries(record)) {
          if (key === '$ref') continue;
          siblings[key] = visit(nested, seen);
        }
        if (Object.keys(siblings).length === 0) {
          return resolved;
        }
        return { ...siblings, ...(resolved as SpecLike) };
      }

      const next: SpecLike = {};
      for (const [key, nested] of Object.entries(record)) {
        next[key] = visit(nested, seen);
      }
      return next;
    }

    return value;
  };

  clone.exports = clone.exports.map((item) => visit(item, new Set()) as typeof item);
  if (clone.types) {
    clone.types = clone.types.map((item) => visit(item, new Set()) as SpecType);
  }

  return clone;
}

function buildTypeLookup(types: SpecType[] | undefined): TypeLookup {
  const map: TypeLookup = new Map();
  if (!Array.isArray(types)) {
    return map;
  }

  for (const type of types) {
    if (type && typeof type.id === 'string') {
      map.set(type.id, type);
    }
  }

  return map;
}

function readTypeRef(value: SpecLike): string | null {
  const ref = (value as { $ref?: unknown }).$ref;
  if (typeof ref !== 'string') {
    return null;
  }

  const prefix = '#/types/';
  if (!ref.startsWith(prefix)) {
    return null;
  }

  return ref.slice(prefix.length);
}

function resolveTypeRef(id: string, lookup: TypeLookup, seen: Set<string>): SpecSchema {
  if (seen.has(id)) {
    return { $ref: `#/types/${id}` };
  }

  const target = lookup.get(id);
  if (!target) {
    return { $ref: `#/types/${id}` };
  }

  seen.add(id);

  if (target.schema) {
    return structuredClone(target.schema);
  }

  return structuredClone(target);
}
