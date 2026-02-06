import type {
  SpecExport,
  SpecSchema,
  SpecSignatureParameter,
  SpecType,
} from '@openpkg-ts/spec';
import type { APIParameterSchema, CodeExample, Language } from '@openpkg-ts/sdk/browser';

/** Processed data for a single export, ready for rendering */
export interface PreparedExport {
  id: string;
  name: string;
  kind: SpecExport['kind'];
  title: string;
  signature: string;
  description?: string;
  parameters: SpecSignatureParameter[];
  examples: CodeExample[];
  languages: Language[];
  returnType?: SpecSchema;
  returnTypeString?: string;
  returnDescription?: string;
  importStatement: string;
  parameterSchema?: APIParameterSchema;
  isAsync?: boolean;
  rawExport: SpecExport;
}

/** Flat lookup of all prepared exports, keyed by exportId */
export interface PreparedSpecData {
  packageName: string;
  packageDescription?: string;
  exports: Record<string, PreparedExport>;
  exportsByKind: Record<string, PreparedExport[]>;
  allExportIds: string[];
  /** Raw types for $ref resolution in components */
  types?: SpecType[];
}

/** Options for deterministic layout generation */
export interface ToSpecOptions {
  theme?: 'default' | 'single';
  groupByKind?: boolean;
}

