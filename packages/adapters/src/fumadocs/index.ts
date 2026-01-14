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
  DocsInstance,
  LoadOptions,
  AlgoliaRecord,
  PagefindRecord,
  SearchIndex,
  SearchOptions,
} from '@openpkg-ts/sdk';

export {
  createDocs,
  loadSpec,
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
  toAlgoliaRecords,
  toPagefindRecords,
  toSearchIndex,
  toSearchIndexJSON,
  toHTML,
  toJSON,
  toJSONString,
  toMarkdown,
  toNavigation,
  toDocusaurusSidebarJS,
  toFumadocsMetaJSON,
  exportToMarkdown,
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

// Fumadocs source integration
export {
  openpkgSource,
  type OpenPkgSourceOptions,
  type OpenPkgPageData,
  type OpenPkgIndexPageData,
  type OpenPkgSinglePageData,
  type OpenPkgMetaData,
} from './source';

// Fumadocs plugin integration
export {
  openpkgPlugin,
  type OpenpkgPluginOptions,
  KindBadge,
  type KindBadgeProps,
} from './plugin';

// Sidebar badge component
export { SidebarKindBadge, type SidebarKindBadgeProps } from './components/sidebar-badge';
