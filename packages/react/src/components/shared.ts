import type { SpecExport } from '@openpkg-ts/spec';
import {
  type DisplayKind,
  DISPLAY_KIND_ORDER,
  KIND_LABELS,
  KIND_SLUGS,
} from '@openpkg-ts/spec';

export type { DisplayKind as ExportKind };

export { DISPLAY_KIND_ORDER as KIND_ORDER, KIND_LABELS, KIND_SLUGS };

export interface CategoryGroup {
  kind: DisplayKind;
  label: string;
  slug: string;
  exports: SpecExport[];
}

const DISPLAY_KIND_SET: Set<string> = new Set(DISPLAY_KIND_ORDER);
function isDisplayKind(kind: string): kind is DisplayKind {
  return DISPLAY_KIND_SET.has(kind);
}

export function groupExportsByKind(exports: SpecExport[]): CategoryGroup[] {
  const groups = new Map<DisplayKind, SpecExport[]>();

  for (const exp of exports) {
    if (!isDisplayKind(exp.kind)) continue;
    const list = groups.get(exp.kind) || [];
    list.push(exp);
    groups.set(exp.kind, list);
  }

  return DISPLAY_KIND_ORDER.filter((kind) => groups.has(kind)).map((kind) => ({
    kind,
    label: KIND_LABELS[kind],
    slug: KIND_SLUGS[kind],
    exports: groups.get(kind)?.sort((a, b) => a.name.localeCompare(b.name)),
  }));
}
