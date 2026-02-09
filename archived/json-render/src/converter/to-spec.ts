import type { OpenPkg } from '@openpkg-ts/spec';
import type { ToSpecOptions } from '../types';

interface SpecElement {
  key: string;
  type: string;
  props: Record<string, unknown>;
  children: string[];
  parentKey: string;
}

interface Spec {
  root: string;
  elements: Record<string, SpecElement>;
}

/** Generate a deterministic json-render Spec from an OpenPkg spec */
export function openpkgToSpec(spec: OpenPkg, options?: ToSpecOptions): Spec {
  const theme = options?.theme ?? 'default';
  const groupByKind = options?.groupByKind ?? true;

  const elements: Record<string, SpecElement> = {};
  const rootKey = 'api-page';

  elements[rootKey] = {
    key: rootKey,
    type: 'APIReferencePage',
    props: {
      title: spec.meta?.name || 'API Reference',
      description: spec.meta?.description || null,
      theme,
    },
    children: [],
    parentKey: '',
  };

  if (groupByKind) {
    // Group exports by kind
    const byKind: Record<string, typeof spec.exports> = {};
    for (const exp of spec.exports) {
      if (!byKind[exp.kind]) byKind[exp.kind] = [];
      byKind[exp.kind].push(exp);
    }

    for (const [_kind, exports] of Object.entries(byKind)) {
      for (const exp of exports) {
        addExportElement(elements, rootKey, exp.id, theme);
      }
    }
  } else {
    for (const exp of spec.exports) {
      addExportElement(elements, rootKey, exp.id, theme);
    }
  }

  return { root: rootKey, elements };
}

function addExportElement(
  elements: Record<string, SpecElement>,
  parentKey: string,
  exportId: string,
  theme: string,
): void {
  const key = `section-${exportId}`;
  const type = theme === 'single' ? 'APISectionSingle' : 'ExportSection';

  elements[key] = {
    key,
    type,
    props: { exportId },
    children: [],
    parentKey,
  };

  elements[parentKey].children.push(key);
}
