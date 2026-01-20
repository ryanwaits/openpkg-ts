/**
 * Filter a spec by various criteria
 * Pure function that returns a new spec (never mutates input)
 */

import type { OpenPkg, SpecExport, SpecExportKind } from '@openpkg-ts/spec';

export type FilterCriteria = {
  /** Filter by export kinds */
  kinds?: SpecExportKind[];
  /** Filter by export names (exact match) */
  names?: string[];
  /** Filter by export IDs */
  ids?: string[];
  /** Filter by tags (export must have at least one matching tag) */
  tags?: string[];
  /** Filter by deprecation status */
  deprecated?: boolean;
  /** Filter by whether export has a description */
  hasDescription?: boolean;
  /** Search term (matches name or description, case-insensitive) */
  search?: string;
  /** Filter by module path (source.file contains this) */
  module?: string;
};

export type FilterResult = {
  /** New spec with only matched exports (immutable) */
  spec: OpenPkg;
  /** Number of exports that matched */
  matched: number;
  /** Total number of exports in original spec */
  total: number;
};

function matchesExport(exp: SpecExport, criteria: FilterCriteria): boolean {
  // AND logic: all specified criteria must match

  if (criteria.kinds && criteria.kinds.length > 0) {
    if (!criteria.kinds.includes(exp.kind)) return false;
  }

  if (criteria.names && criteria.names.length > 0) {
    if (!criteria.names.includes(exp.name)) return false;
  }

  if (criteria.ids && criteria.ids.length > 0) {
    if (!criteria.ids.includes(exp.id)) return false;
  }

  if (criteria.tags && criteria.tags.length > 0) {
    const expTags = exp.tags?.map((t) => t.name) ?? [];
    if (!criteria.tags.some((tag) => expTags.includes(tag))) return false;
  }

  if (criteria.deprecated !== undefined) {
    if ((exp.deprecated ?? false) !== criteria.deprecated) return false;
  }

  if (criteria.hasDescription !== undefined) {
    const has = Boolean(exp.description && exp.description.trim().length > 0);
    if (has !== criteria.hasDescription) return false;
  }

  if (criteria.search) {
    const term = criteria.search.toLowerCase();
    const nameMatch = exp.name.toLowerCase().includes(term);
    const descMatch = exp.description?.toLowerCase().includes(term) ?? false;
    if (!nameMatch && !descMatch) return false;
  }

  if (criteria.module) {
    const file = exp.source?.file ?? '';
    if (!file.includes(criteria.module)) return false;
  }

  return true;
}

/**
 * Filter a spec by various criteria.
 * Returns a new spec with only matched exports (never mutates input).
 * Uses AND logic: all specified criteria must match.
 * Types are always preserved (no pruning).
 *
 * @param spec - The spec to filter
 * @param criteria - Filter criteria (empty criteria matches all)
 * @returns FilterResult with new spec, matched count, total count
 */
export function filterSpec(spec: OpenPkg, criteria: FilterCriteria): FilterResult {
  const total = spec.exports.length;

  // Empty criteria matches all
  const isEmpty = Object.keys(criteria).length === 0;
  if (isEmpty) {
    return {
      spec: {
        ...spec,
        exports: [...spec.exports],
        types: spec.types ? [...spec.types] : undefined,
      },
      matched: total,
      total,
    };
  }

  const matched: SpecExport[] = [];
  for (const exp of spec.exports) {
    if (matchesExport(exp, criteria)) {
      matched.push(exp);
    }
  }

  // Create new spec (immutable) - keep all types
  const newSpec: OpenPkg = {
    ...spec,
    exports: matched,
    types: spec.types ? [...spec.types] : undefined,
  };

  return {
    spec: newSpec,
    matched: matched.length,
    total,
  };
}
