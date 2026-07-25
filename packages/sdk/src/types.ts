import type { OpenPkg } from '@openpkg-ts/spec';

/** Configuration for resolving external package re-exports */
export interface ExternalsConfig {
  /** Package patterns to resolve (globs supported, e.g., "@myorg/*") */
  include?: string[];
  /** Package patterns to never resolve */
  exclude?: string[];
  /** Max transitive depth for resolution (default: 1) */
  depth?: number;
}

export interface ExtractOptions {
  entryFile: string;
  baseDir?: string;
  content?: string; // For in-memory analysis
  maxTypeDepth?: number;
  maxExternalTypeDepth?: number;
  resolveExternalTypes?: boolean;
  schemaExtraction?: 'static' | 'hybrid';
  /** Include $schema URL in output */
  includeSchema?: boolean;
  /** Only extract these exports (supports * wildcards) */
  only?: string[];
  /** Ignore these exports (supports * wildcards) */
  ignore?: string[];
  /** Progress callback for tracking extraction progress */
  onProgress?: (current: number, total: number, item: string) => void;
  /** Whether source is a .d.ts file (degraded mode - TSDoc may be missing) */
  isDtsSource?: boolean;
  /** Include private/protected class members (default: false) */
  includePrivate?: boolean;
  /** Configuration for resolving external package re-exports */
  externals?: ExternalsConfig;
  /** Max properties to serialize per object type (default: 500) */
  maxProperties?: number;
  /**
   * Register referenced-but-not-exported types from dependencies as named
   * types[] entries. true → all packages; string[] → listed packages (plus
   * workspace siblings); false → disable the expansion pass; default →
   * workspace sibling packages only.
   */
  followExternal?: boolean | string[];
  /** Callback when properties are truncated */
  onTruncation?: (typeName: string, actual: number, limit: number) => void;
}

export interface ExtractResult {
  spec: OpenPkg;
  diagnostics: Diagnostic[];
  forgottenExports?: ForgottenExport[];
  /** Metadata about runtime schema extraction (when schemaExtraction: 'hybrid') */
  runtimeSchemas?: {
    /** Number of schema exports found */
    extracted: number;
    /** Number of schemas successfully merged with static types */
    merged: number;
    /** Schema vendors detected (e.g., 'zod', 'arktype', 'valibot', 'typebox') */
    vendors: string[];
    /** Any errors encountered during runtime extraction */
    errors: string[];
    /** Non-fatal warnings from extraction (e.g., individual schema failures) */
    warnings: Array<{ code: string; message: string; exportName?: string }>;
    /** Extraction method used: 'compiled' or 'direct-ts (runtime)' */
    method?: string;
  };
  /** Degraded mode info when extracting from .d.ts files */
  degradedMode?: {
    reason: 'dts-source';
    stats: {
      exportsWithoutDescription: number;
      paramsWithoutDocs: number;
      missingExamples: number;
    };
  };
  /** Export verification comparing discovered vs extracted */
  verification?: ExportVerification;
}

export interface Diagnostic {
  message: string;
  severity: 'error' | 'warning' | 'info';
  code?: string;
  suggestion?: string;
  location?: { file?: string; line?: number; column?: number };
}

/** Context tracking for type references in public API */
export interface TypeReference {
  typeName: string;
  exportName: string;
  location: 'return' | 'parameter' | 'property' | 'extends' | 'type-parameter';
  path?: string;
}

/** Structured data for forgotten exports */
export interface ForgottenExport {
  name: string;
  definedIn?: string;
  referencedBy: TypeReference[];
  isExternal: boolean;
  fix?: string;
}

/** Tracks status of each discovered export through serialization pipeline */
export interface ExportTracker {
  name: string;
  discovered: boolean;
  status: 'pending' | 'success' | 'skipped' | 'failed';
  skipReason?: 'filtered' | 'no-declaration' | 'internal' | 'external-unresolved';
  /** Package name for external-unresolved skips */
  externalPackage?: string;
  error?: string;
  kind?: string;
}

/** Detail for a skipped export */
export interface SkippedExportDetail {
  name: string;
  reason: 'filtered' | 'no-declaration' | 'internal' | 'external-unresolved';
  /** Package name when reason is external-unresolved */
  package?: string;
}

/** Verification result comparing discovered vs extracted exports */
export interface ExportVerification {
  /** Total exports discovered by TypeScript */
  discovered: number;
  /** Exports successfully extracted */
  extracted: number;
  /** Exports skipped (filtered, no-declaration, internal, external-unresolved) */
  skipped: number;
  /** Exports that failed during serialization */
  failed: number;
  /** Delta: discovered - extracted */
  delta: number;
  details: {
    skipped: SkippedExportDetail[];
    failed: Array<{ name: string; error: string }>;
  };
}
