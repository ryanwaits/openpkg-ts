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

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createDocs, type DocsInstance } from '@openpkg-ts/sdk';
import type { OpenPkg } from '@openpkg-ts/spec';
import { type DocAdapter, registerAdapter } from '../registry';

// Self-register fumadocs adapter
const fumadocsAdapter: DocAdapter = {
  id: 'fumadocs',
  name: 'Fumadocs',
  generate: async (spec: OpenPkg, outDir: string) => {
    const docs: DocsInstance = createDocs(spec);
    const exports = docs.getAllExports();

    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    // Generate markdown files for each export
    for (const exp of exports) {
      const content = docs.toMarkdown({ export: exp.id, frontmatter: true, codeSignatures: true });
      const filename = `${exp.name}.md`;
      fs.writeFileSync(path.join(outDir, filename), content);
    }
  },
};

registerAdapter(fumadocsAdapter);

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
