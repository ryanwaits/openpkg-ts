import type { OpenPkgVersion, SpecExportKind } from './types';

export const SCHEMA_VERSION: OpenPkgVersion = '0.4.0';
/** Canonical schema URL — hosted by the OpenPkg standard, independent of any implementation's packaging. */
export const SCHEMA_URL = 'https://openpkg.dev/schemas/v0.4.0/openpkg.schema.json';
/** Mirror of the canonical schema, served from the published @openpkg-ts/spec npm package. */
export const SCHEMA_URL_MIRROR =
  'https://unpkg.com/@openpkg-ts/spec/schemas/v0.4.0/openpkg.schema.json';
export const JSON_SCHEMA_DRAFT = 'https://json-schema.org/draft/2020-12/schema';

/** The 6 export kinds relevant for UI display (excludes namespace, module, reference, external). */
export type DisplayKind = Extract<
  SpecExportKind,
  'function' | 'class' | 'interface' | 'type' | 'enum' | 'variable'
>;

/** Canonical display order for UI-facing export kind groups. */
export const DISPLAY_KIND_ORDER: DisplayKind[] = [
  'function',
  'class',
  'interface',
  'type',
  'enum',
  'variable',
];

/** Human-readable plural labels for every export kind. */
export const KIND_LABELS: Record<SpecExportKind, string> = {
  function: 'Functions',
  class: 'Classes',
  interface: 'Interfaces',
  type: 'Types',
  enum: 'Enums',
  variable: 'Variables',
  namespace: 'Namespaces',
  module: 'Modules',
  reference: 'References',
  external: 'External',
};

/** URL-safe slug for every export kind. */
export const KIND_SLUGS: Record<SpecExportKind, string> = {
  function: 'functions',
  class: 'classes',
  interface: 'interfaces',
  type: 'types',
  enum: 'enums',
  variable: 'variables',
  namespace: 'namespaces',
  module: 'modules',
  reference: 'references',
  external: 'externals',
};
