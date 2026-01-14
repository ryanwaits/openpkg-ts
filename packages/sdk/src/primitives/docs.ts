/**
 * Generate documentation from OpenPkg specs
 * Re-exports doc generation utilities from SDK core and render modules
 */
export {
  // Core loader
  createDocs,
  loadSpec,
  type DocsInstance,
  type LoadOptions,

  // Query utilities
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

  // Format utilities
  formatBadges,
  getMemberBadges,

  // Search
  toSearchIndex,
  toSearchIndexJSON,
  toAlgoliaRecords,
  toPagefindRecords,
  type SearchIndex,
  type SearchOptions,
  type SearchRecord,
  type AlgoliaRecord,
  type PagefindRecord,
} from '../core';

export {
  // Render functions
  toMarkdown,
  toHTML,
  toJSON,
  toJSONString,
  exportToMarkdown,
  toNavigation,
  toDocusaurusSidebarJS,
  toFumadocsMetaJSON,

  // Types
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
} from '../render';

// Alias for convenience
export { toMarkdown as generateDocs } from '../render';
