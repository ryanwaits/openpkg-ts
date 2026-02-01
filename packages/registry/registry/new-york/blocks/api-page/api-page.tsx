'use client';

import type { DocsInstance } from '@openpkg-ts/sdk/browser';
import type { OpenPkg } from '@openpkg-ts/spec';
import { ExportIndexPage } from '@/registry/new-york/blocks/export-index-page/export-index-page';
import { ExportSection } from '@/registry/new-york/components/export-section/export-section';

export interface APIPageProps {
  /** Direct spec object */
  spec?: OpenPkg;
  /** Or docs instance from createDocs() */
  instance?: DocsInstance;
  /** Export ID to render, or undefined for index page */
  id?: string;
  /** Base href for index page links */
  baseHref?: string;
  /** Description for index page */
  description?: string;
}

function NotFound({ id }: { id: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-6 text-center">
      <p className="text-muted-foreground">
        Export <code className="font-mono text-primary">{id}</code> not found in spec.
      </p>
    </div>
  );
}

function NoSpec() {
  return (
    <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-6 text-center">
      <p className="text-red-600 dark:text-red-400">
        No spec provided. Pass either <code>spec</code> or <code>instance</code> prop.
      </p>
    </div>
  );
}

/**
 * Main API page component. Renders index (grid) or detail (section) based on id prop.
 */
export function APIPage({
  spec,
  instance,
  id,
  baseHref = '',
  description,
}: APIPageProps): React.ReactNode {
  const resolvedSpec = spec ?? instance?.spec;

  if (!resolvedSpec) return <NoSpec />;

  if (!id) {
    return <ExportIndexPage spec={resolvedSpec} baseHref={baseHref} description={description} />;
  }

  const exp = resolvedSpec.exports.find((e) => e.id === id);
  if (!exp) return <NotFound id={id} />;

  return <ExportSection export={exp} spec={resolvedSpec} />;
}
