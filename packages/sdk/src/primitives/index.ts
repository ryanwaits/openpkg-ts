/**
 * SDK Primitives
 *
 * Atomic operations for working with TypeScript APIs:
 * - listExports() - list exports from an entry point
 * - getExport() - get detailed spec for a single export
 * - extractSpec() - generate full OpenPkg spec
 * - diffSpecs() - compare two specs
 * - generateDocs() - generate documentation
 */

// List exports
export {
  listExports,
  type ListExportsOptions,
  type ListExportsResult,
  type ExportItem,
} from './list';

// Get single export
export {
  getExport,
  type GetExportOptions,
  type GetExportResult,
} from './get';

// Extract full spec
export {
  extractSpec,
  type ExtractOptions,
  type ExtractResult,
} from './spec';

// Diff specs
export {
  diffSpec,
  diffSpecs,
  categorizeBreakingChanges,
  recommendSemverBump,
  calculateNextVersion,
  type SpecDiff,
  type BreakingSeverity,
  type CategorizedBreaking,
  type MemberChangeInfo,
  type SemverBump,
  type SemverRecommendation,
} from './diff';

// Generate docs
export {
  generateDocs,
  createDocs,
  loadSpec,
  toMarkdown,
  toHTML,
  toJSON,
  toJSONString,
  exportToMarkdown,
  toNavigation,
  toDocusaurusSidebarJS,
  toFumadocsMetaJSON,
  toSearchIndex,
  toSearchIndexJSON,
  toAlgoliaRecords,
  toPagefindRecords,
  buildSignatureString,
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
  sortByName,
  formatBadges,
  getMemberBadges,
  type DocsInstance,
  type LoadOptions,
  type MarkdownOptions,
  type HTMLOptions,
  type JSONOptions,
  type ExportMarkdownOptions,
  type NavOptions,
  type NavFormat,
  type GroupBy,
  type SimplifiedSpec,
  type SimplifiedExport,
  type SimplifiedMember,
  type SimplifiedSignature,
  type SimplifiedParameter,
  type SimplifiedReturn,
  type SimplifiedExample,
  type SearchIndex,
  type SearchOptions,
  type SearchRecord,
  type AlgoliaRecord,
  type PagefindRecord,
} from './docs';
