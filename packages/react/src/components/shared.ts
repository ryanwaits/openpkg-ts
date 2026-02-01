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

export function groupExportsByKind(exports: SpecExport[]): CategoryGroup[] {
  const groups = new Map<DisplayKind, SpecExport[]>();

  for (const exp of exports) {
    const kind = exp.kind as string;
    if (!(DISPLAY_KIND_ORDER as string[]).includes(kind)) continue;
    const displayKind = kind as DisplayKind;
    const list = groups.get(displayKind) || [];
    list.push(exp);
    groups.set(displayKind, list);
  }

  return DISPLAY_KIND_ORDER.filter((kind) => groups.has(kind)).map((kind) => ({
    kind,
    label: KIND_LABELS[kind],
    slug: KIND_SLUGS[kind],
    exports: groups.get(kind)?.sort((a, b) => a.name.localeCompare(b.name)),
  }));
}
