/**
 * @openpkg-ts/adapters/fumadocs
 *
 * Fumadocs integration for OpenPkg API documentation.
 *
 * @example
 * ```ts
 * import { loader } from 'fumadocs-core/source';
 * import { openpkgSource, openpkgPlugin } from '@openpkg-ts/adapters/fumadocs';
 * import spec from './openpkg.json';
 *
 * export const source = loader({
 *   baseUrl: '/docs/api',
 *   source: openpkgSource({ spec }),
 *   plugins: [openpkgPlugin()],
 * });
 * ```
 */

// Re-export core SDK types for convenience
export type {
  AlgoliaRecord,
  DocsInstance,
  LoadOptions,
  PagefindRecord,
  SearchIndex,
  SearchOptions,
} from '@openpkg-ts/sdk';

export {
  buildSignatureString,
  createDocs,
  exportToMarkdown,
  formatParameters,
  formatReturnType,
  formatSchema,
  formatTypeParameters,
  getMethods,
  getProperties,
  groupByVisibility,
  isMethod,
  isProperty,
  loadSpec,
  resolveTypeRef,
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
} from '@openpkg-ts/sdk';

// Re-export spec types
export type {
  OpenPkg,
  SpecExample,
  SpecExport,
  SpecExportKind,
  SpecMember,
  SpecSchema,
  SpecSignature,
  SpecSignatureParameter,
  SpecTag,
  SpecType,
  SpecTypeKind,
  SpecTypeParameter,
} from '@openpkg-ts/spec';
// Sidebar badge component
export { SidebarKindBadge, type SidebarKindBadgeProps } from './components/sidebar-badge';

// Fumadocs plugin integration
export {
  KindBadge,
  type KindBadgeProps,
  type OpenpkgPluginOptions,
  openpkgPlugin,
} from './plugin';
// Fumadocs source integration
export {
  type OpenPkgIndexPageData,
  type OpenPkgMetaData,
  type OpenPkgPageData,
  type OpenPkgSinglePageData,
  type OpenPkgSourceOptions,
  openpkgSource,
} from './source';
