/**
 * Browser-safe SDK exports.
 * Use this entry point in client-side code (Vite, CRA, Next.js client components).
 * Does NOT include extraction, file I/O, or Node.js-dependent code.
 */

// Query utilities (pure functions)
export {
  buildSignatureString,
  type FormatSchemaOptions,
  formatConditionalType,
  formatMappedType,
  formatParameters,
  formatReturnType,
  formatSchema,
  formatTypeParameters,
  getMethods,
  getProperties,
  groupByVisibility,
  isMethod,
  isProperty,
  resolveTypeRef,
  type SpecConditionalType,
  type SpecMappedType,
  sortByName,
} from './core/query';

// Query builder
export { query, QueryBuilder } from './core/query-builder';

// Format utilities
export { formatBadges, getMemberBadges } from './core/format';

// Diagnostics (analysis only, no file I/O)
export {
  analyzeSpec,
  type DiagnosticItem,
  findMissingParamDocs,
  getDeprecationMessage,
  hasDeprecatedTag,
  type SpecDiagnostics,
} from './core/diagnostics';

// Search utilities
export {
  type AlgoliaRecord,
  type PagefindRecord,
  type SearchIndex,
  type SearchOptions,
  type SearchRecord,
  toAlgoliaRecords,
  toPagefindRecords,
  toSearchIndex,
  toSearchIndexJSON,
} from './core/search';

// Types only (no runtime code)
export type { DocsInstance, LoadOptions } from './core/loader';
