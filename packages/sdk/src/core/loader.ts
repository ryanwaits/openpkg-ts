import * as fs from 'node:fs';
import type { OpenPkg, SpecExport, SpecExportKind, SpecType } from '@openpkg-ts/spec';
import { validateSpec } from '@openpkg-ts/spec';
import { type HTMLOptions, toHTML } from '../render/html';
import {
  type JSONOptions,
  type SimplifiedExport,
  type SimplifiedSpec,
  toJSON,
} from '../render/json';
import { type ExportMarkdownOptions, toMarkdown } from '../render/markdown';
import {
  type DocusaurusSidebar,
  type FumadocsMeta,
  type GenericNav,
  type NavOptions,
  toNavigation,
} from '../render/nav';
import {
  type AlgoliaRecord,
  type PagefindRecord,
  type SearchIndex,
  type SearchOptions,
  toAlgoliaRecords,
  toPagefindRecords,
  toSearchIndex,
} from './search';

export interface LoadOptions {
  /** Path to openpkg.json file or the spec object directly */
  input: string | OpenPkg;
}

export interface DocsInstance {
  /** The parsed OpenPkg spec */
  spec: OpenPkg;

  // Basic queries
  /** Get an export by its ID */
  getExport(id: string): SpecExport | undefined;
  /** Get a type definition by its ID */
  getType(id: string): SpecType | undefined;
  /** Get all exports of a specific kind */
  getExportsByKind(kind: SpecExportKind): SpecExport[];
  /** Get all exports */
  getAllExports(): SpecExport[];
  /** Get all type definitions */
  getAllTypes(): SpecType[];

  // Extended queries
  /** Get exports by JSDoc tag (e.g., '@beta', '@internal') */
  getExportsByTag(tagName: string): SpecExport[];
  /** Search exports by name or description */
  search(query: string): SpecExport[];
  /** Get exports belonging to a specific module/namespace */
  getModule(moduleName: string): SpecExport[];
  /** Get deprecated exports */
  getDeprecated(): SpecExport[];
  /** Get exports grouped by kind */
  groupByKind(): Record<SpecExportKind, SpecExport[]>;

  // Render methods — all return strings or plain data, not React components.
  // Bring your own UI components.
  /** Render spec or single export to an MDX string */
  toMarkdown(options?: ExportMarkdownOptions): string;
  /** Render spec or single export to an HTML string */
  toHTML(options?: HTMLOptions): string;
  /** Render spec or single export to a simplified JSON structure */
  toJSON(options?: JSONOptions): SimplifiedSpec | SimplifiedExport;
  /** Generate navigation data structure (JSON object, not a component) */
  toNavigation(options?: NavOptions): GenericNav | FumadocsMeta | DocusaurusSidebar;
  /** Generate search index data */
  toSearchIndex(options?: SearchOptions): SearchIndex;
  /** Generate Pagefind-compatible record objects */
  toPagefindRecords(options?: SearchOptions): PagefindRecord[];
  /** Generate Algolia-compatible record objects */
  toAlgoliaRecords(options?: SearchOptions): AlgoliaRecord[];
}

/**
 * Loads an OpenPkg spec from file or object.
 *
 * @example
 * ```ts
 * import { loadSpec } from '@openpkg-ts/sdk'
 *
 * // From spec object
 * import spec from './openpkg.json'
 * const docs = loadSpec(spec)
 * ```
 */
export function loadSpec(spec: OpenPkg): DocsInstance {
  return createDocsInstance(spec);
}

/**
 * Creates a docs instance for querying and rendering API documentation.
 *
 * Render methods (toMarkdown, toHTML, toJSON, toNavigation) return strings or
 * plain data objects — not React components. Bring your own UI components.
 *
 * @example
 * ```ts
 * import { createDocs } from '@openpkg-ts/sdk'
 *
 * // From file path
 * const docs = createDocs('./openpkg.json')
 *
 * // From spec object
 * import spec from './openpkg.json'
 * const docs = createDocs(spec)
 *
 * // Query
 * docs.getExport('useState')
 * docs.getExportsByKind('function')
 * docs.getExportsByTag('@beta')
 * docs.search('hook')
 * ```
 */
export function createDocs(input: string | OpenPkg): DocsInstance {
  let spec: unknown;

  if (typeof input === 'string') {
    try {
      spec = JSON.parse(fs.readFileSync(input, 'utf-8'));
    } catch (err) {
      throw new Error(
        `Failed to parse spec file: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  } else {
    spec = input;
  }

  // Validate spec structure
  const validation = validateSpec(spec);
  if (!validation.ok) {
    const errors = validation.errors
      .slice(0, 5)
      .map((e) => `${e.instancePath || '/'}: ${e.message}`)
      .join('; ');
    throw new Error(`Invalid OpenPkg spec: ${errors}`);
  }

  return createDocsInstance(spec as OpenPkg);
}

function createDocsInstance(spec: OpenPkg): DocsInstance {
  // Build indices for fast lookups
  const exportsById = new Map<string, SpecExport>();
  const typesById = new Map<string, SpecType>();
  const exportsByTag = new Map<string, SpecExport[]>();
  const exportsByModule = new Map<string, SpecExport[]>();

  // Index exports
  for (const exp of spec.exports) {
    exportsById.set(exp.id, exp);

    // Index by tags
    if (exp.tags) {
      for (const tag of exp.tags) {
        const tagKey = tag.name.startsWith('@') ? tag.name : `@${tag.name}`;
        const existing = exportsByTag.get(tagKey) ?? [];
        existing.push(exp);
        exportsByTag.set(tagKey, existing);
      }
    }

    // Index by module (from source file path or namespace)
    const moduleName = extractModuleName(exp);
    if (moduleName) {
      const existing = exportsByModule.get(moduleName) ?? [];
      existing.push(exp);
      exportsByModule.set(moduleName, existing);
    }
  }

  // Index types
  if (spec.types) {
    for (const type of spec.types) {
      typesById.set(type.id, type);
    }
  }

  return {
    spec,

    getExport(id: string): SpecExport | undefined {
      return exportsById.get(id);
    },

    getType(id: string): SpecType | undefined {
      return typesById.get(id);
    },

    getExportsByKind(kind: SpecExportKind): SpecExport[] {
      return spec.exports.filter((exp) => exp.kind === kind);
    },

    getAllExports(): SpecExport[] {
      return spec.exports;
    },

    getAllTypes(): SpecType[] {
      return spec.types ?? [];
    },

    getExportsByTag(tagName: string): SpecExport[] {
      const normalizedTag = tagName.startsWith('@') ? tagName : `@${tagName}`;
      return exportsByTag.get(normalizedTag) ?? [];
    },

    search(query: string): SpecExport[] {
      const lowerQuery = query.toLowerCase();
      return spec.exports.filter((exp) => {
        // Match name
        if (exp.name.toLowerCase().includes(lowerQuery)) return true;
        // Match description
        if (exp.description?.toLowerCase().includes(lowerQuery)) return true;
        // Match tags
        if (exp.tags?.some((t) => t.text.toLowerCase().includes(lowerQuery))) return true;
        return false;
      });
    },

    getModule(moduleName: string): SpecExport[] {
      return exportsByModule.get(moduleName) ?? [];
    },

    getDeprecated(): SpecExport[] {
      return spec.exports.filter((exp) => exp.deprecated === true);
    },

    groupByKind(): Record<SpecExportKind, SpecExport[]> {
      const groups = {} as Record<SpecExportKind, SpecExport[]>;
      for (const exp of spec.exports) {
        if (!groups[exp.kind]) {
          groups[exp.kind] = [];
        }
        groups[exp.kind].push(exp);
      }
      return groups;
    },

    // Render methods
    toMarkdown(options?: ExportMarkdownOptions): string {
      return toMarkdown(spec, options);
    },

    toHTML(options?: HTMLOptions): string {
      return toHTML(spec, options);
    },

    toJSON(options?: JSONOptions): SimplifiedSpec | SimplifiedExport {
      return toJSON(spec, options);
    },

    toNavigation(options?: NavOptions): GenericNav | FumadocsMeta | DocusaurusSidebar {
      return toNavigation(spec, options);
    },

    toSearchIndex(options?: SearchOptions): SearchIndex {
      return toSearchIndex(spec, options);
    },

    toPagefindRecords(options?: SearchOptions): PagefindRecord[] {
      return toPagefindRecords(spec, options);
    },

    toAlgoliaRecords(options?: SearchOptions): AlgoliaRecord[] {
      return toAlgoliaRecords(spec, options);
    },
  };
}

/**
 * Extract module name from export source or ID.
 */
function extractModuleName(exp: SpecExport): string | undefined {
  // Try source file path
  if (exp.source?.file) {
    const parts = exp.source.file.split('/');
    // Get directory or file name without extension
    const lastPart = parts[parts.length - 1];
    if (lastPart === 'index.ts' || lastPart === 'index.tsx') {
      return parts[parts.length - 2] || 'root';
    }
    return lastPart.replace(/\.[jt]sx?$/, '');
  }

  // Try namespace from kind
  if (exp.kind === 'namespace' || exp.kind === 'module') {
    return exp.name;
  }

  return undefined;
}
