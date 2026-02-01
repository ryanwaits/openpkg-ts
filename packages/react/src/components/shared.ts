import type { SpecExport } from '@openpkg-ts/spec';

export type ExportKind = 'function' | 'class' | 'interface' | 'type' | 'enum' | 'variable';

export interface CategoryGroup {
  kind: ExportKind;
  label: string;
  slug: string;
  exports: SpecExport[];
}

export const KIND_ORDER: ExportKind[] = [
  'function',
  'class',
  'interface',
  'type',
  'enum',
  'variable',
];

export const KIND_LABELS: Record<ExportKind, string> = {
  function: 'Functions',
  class: 'Classes',
  interface: 'Interfaces',
  type: 'Types',
  enum: 'Enums',
  variable: 'Variables',
};

export const KIND_SLUGS: Record<ExportKind, string> = {
  function: 'functions',
  class: 'classes',
  interface: 'interfaces',
  type: 'types',
  enum: 'enums',
  variable: 'variables',
};

export function groupExportsByKind(exports: SpecExport[]): CategoryGroup[] {
  const groups: Map<ExportKind, SpecExport[]> = new Map();

  for (const exp of exports) {
    const kind = (exp.kind as ExportKind) || 'variable';
    const normalizedKind = KIND_ORDER.includes(kind) ? kind : 'variable';
    const list = groups.get(normalizedKind) || [];
    list.push(exp);
    groups.set(normalizedKind, list);
  }

  return KIND_ORDER.filter((kind) => groups.has(kind)).map((kind) => ({
    kind,
    label: KIND_LABELS[kind],
    slug: KIND_SLUGS[kind],
    exports: groups.get(kind)?.sort((a, b) => a.name.localeCompare(b.name)),
  }));
}
