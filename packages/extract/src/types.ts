import type { OpenPkg } from '@openpkg-ts/spec';

export interface ExtractOptions {
  entryFile: string;
  baseDir?: string;
  content?: string; // For in-memory analysis
  maxTypeDepth?: number;
  maxExternalTypeDepth?: number;
  resolveExternalTypes?: boolean;
  schemaExtraction?: 'static' | 'hybrid';
  /** Target JSON Schema dialect for runtime schema extraction */
  schemaTarget?: 'draft-2020-12' | 'draft-07' | 'openapi-3.0';
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
