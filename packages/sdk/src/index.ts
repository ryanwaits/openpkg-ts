/**
 * @openpkg-ts/sdk
 *
 * TypeScript API extraction SDK - programmatic primitives for OpenPkg specs.
 *
 * @example
 * ```typescript
 * import { listExports, getExport, extractSpec, diffSpecs, createDocs, toMarkdown } from '@openpkg-ts/sdk';
 *
 * // List exports
 * const { exports } = await listExports({ entryFile: './src/index.ts' });
 *
 * // Get single export
 * const { export: spec } = await getExport({ entryFile: './src/index.ts', exportName: 'myFunc' });
 *
 * // Extract full spec
 * const { spec } = await extractSpec({ entryFile: './src/index.ts' });
 *
 * // Diff two specs
 * const diff = diffSpecs(oldSpec, newSpec);
 *
 * // Generate docs
 * const docs = createDocs(spec);
 * const markdown = docs.toMarkdown();
 * ```
 */

// =============================================================================
// Primitives (main SDK API)
// =============================================================================
export * from './primitives';

// =============================================================================
// Rendering & Documentation
// =============================================================================

// Core utilities (query, format, search, loader)
export * from './core';

// Renderers (markdown, html, json, nav)
export * from './render';

// =============================================================================
// Low-level utilities (for advanced use)
// =============================================================================

// AST utilities
export * from './ast';
// Legacy export (deprecated - use extractSpec instead)
export { extract } from './builder';
// Compiler utilities
export * from './compiler';
// Schema adapters
export * from './schema';
// Serializers
export * from './serializers';

// Additional types
export type {
  Diagnostic,
  ExportTracker,
  ExportVerification,
  ExternalsConfig,
  ExtractOptions,
  ExtractResult,
  ForgottenExport,
  SkippedExportDetail,
  TypeReference,
} from './types';
// Type utilities
export * from './types/index';

// Utilities
export { CacheManager, type CacheManagerOptions } from './utils';
