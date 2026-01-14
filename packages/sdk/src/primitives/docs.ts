/**
 * Generate documentation from OpenPkg specs
 * Re-exports doc generation utilities from SDK core and render modules
 */
export {
  type AlgoliaRecord,
  // Query utilities
  buildSignatureString,
  // Core loader
  createDocs,
  type DocsInstance,
  // Format utilities
  formatBadges,
  formatParameters,
  formatReturnType,
  formatSchema,
  formatTypeParameters,
  getMemberBadges,
  getMethods,
  getProperties,
  groupByVisibility,
  isMethod,
  isProperty,
  type LoadOptions,
  loadSpec,
  type PagefindRecord,
  resolveTypeRef,
  type SearchIndex,
  type SearchOptions,
  type SearchRecord,
  sortByName,
  toAlgoliaRecords,
  toPagefindRecords,
  // Search
  toSearchIndex,
  toSearchIndexJSON,
} from '../core';
// Alias for convenience
export {
  type ExportMarkdownOptions,
  exportToMarkdown,
  type GroupBy,
  type HTMLOptions,
  type JSONOptions,
  // Types
  type MarkdownOptions,
  type NavFormat,
  type NavOptions,
  type SimplifiedExample,
  type SimplifiedExport,
  type SimplifiedMember,
  type SimplifiedParameter,
  type SimplifiedReturn,
  type SimplifiedSignature,
  type SimplifiedSpec,
  toDocusaurusSidebarJS,
  toFumadocsMetaJSON,
  toHTML,
  toJSON,
  toJSONString,
  // Render functions
  toMarkdown,
  toMarkdown as generateDocs,
  toNavigation,
} from '../render';
