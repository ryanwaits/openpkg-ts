/**
 * SDK Primitives
 *
 * Atomic operations for working with TypeScript APIs:
 * - listExports() - list exports from an entry point
 * - getExport() - get detailed spec for a single export
 * - extractSpec() - generate full OpenPkg spec
 * - diffSpecs() - compare two specs
 * - filterSpec() - filter spec by criteria
 * - generateDocs() - generate documentation
 */

// Diff specs
export {
  type BreakingSeverity,
  type CategorizedBreaking,
  calculateNextVersion,
  categorizeBreakingChanges,
  diffSpec,
  diffSpecs,
  type MemberChangeInfo,
  recommendSemverBump,
  type SemverBump,
  type SemverRecommendation,
  type SpecDiff,
} from './diff';
// Generate docs
export {
  type AlgoliaRecord,
  buildSignatureString,
  createDocs,
  type DocsInstance,
  type ExportMarkdownOptions,
  exportToMarkdown,
  formatBadges,
  formatParameters,
  formatReturnType,
  formatSchema,
  formatTypeParameters,
  type GroupBy,
  generateDocs,
  getMemberBadges,
  getMethods,
  getProperties,
  groupByVisibility,
  type HTMLOptions,
  isMethod,
  isProperty,
  type JSONOptions,
  type LoadOptions,
  loadSpec,
  type MarkdownOptions,
  type NavFormat,
  type NavOptions,
  type PagefindRecord,
  resolveTypeRef,
  type SearchIndex,
  type SearchOptions,
  type SearchRecord,
  type SimplifiedExample,
  type SimplifiedExport,
  type SimplifiedMember,
  type SimplifiedParameter,
  type SimplifiedReturn,
  type SimplifiedSignature,
  type SimplifiedSpec,
  sortByName,
  toAlgoliaRecords,
  toDocusaurusSidebarJS,
  toFumadocsMetaJSON,
  toHTML,
  toJSON,
  toJSONString,
  toMarkdown,
  toNavigation,
  toPagefindRecords,
  toSearchIndex,
  toSearchIndexJSON,
} from './docs';
// Filter spec
export { type FilterCriteria, type FilterResult, filterSpec } from './filter';
// Get single export
export {
  type GetExportOptions,
  type GetExportResult,
  getExport,
} from './get';
// List exports
export {
  type ExportItem,
  type ListExportsOptions,
  type ListExportsResult,
  listExports,
} from './list';
// Extract full spec
export {
  type ExtractOptions,
  type ExtractResult,
  extractSpec,
} from './spec';
// Validate spec against the meta-schema
export {
  assertSpec,
  getAvailableVersions,
  getValidationErrors,
  LATEST_VERSION,
  type SchemaVersion,
  type SpecError,
  validateSpec,
} from './validate';
