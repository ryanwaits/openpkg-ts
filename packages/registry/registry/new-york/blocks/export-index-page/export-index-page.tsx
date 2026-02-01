'use client';

import type { OpenPkg, SpecExport } from '@openpkg-ts/spec';
import {
  type DisplayKind,
  DISPLAY_KIND_ORDER,
  KIND_LABELS,
  KIND_SLUGS,
} from '@openpkg-ts/spec';
import { cn } from '@openpkg-ts/ui/lib/utils';
import { Search } from 'lucide-react';
import { type ReactNode, useMemo, useState } from 'react';
import { ExportCard } from '@/registry/new-york/ui/export-card/export-card';

export type ExportKind = DisplayKind;

interface CategoryGroup {
  kind: DisplayKind;
  label: string;
  slug: string;
  exports: SpecExport[];
}

const DISPLAY_KIND_SET: Set<string> = new Set(DISPLAY_KIND_ORDER);
function isDisplayKind(kind: string): kind is DisplayKind {
  return DISPLAY_KIND_SET.has(kind);
}

function groupExportsByKind(exports: SpecExport[]): CategoryGroup[] {
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
    exports: groups.get(kind)?.sort((a, b) => a.name.localeCompare(b.name)) ?? [],
  }));
}

export interface ExportIndexPageProps {
  spec: OpenPkg;
  baseHref: string;
  description?: string;
  className?: string;
  showSearch?: boolean;
  showFilters?: boolean;
}

/**
 * Index page showing all exports in a grid, grouped by category.
 */
export function ExportIndexPage({
  spec,
  baseHref,
  description,
  className,
  showSearch = true,
  showFilters = true,
}: ExportIndexPageProps): ReactNode {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<ExportKind | 'all'>('all');

  const allGroups = useMemo(() => groupExportsByKind(spec.exports), [spec.exports]);

  const filteredGroups = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();

    return allGroups
      .filter((group) => activeFilter === 'all' || group.kind === activeFilter)
      .map((group) => ({
        ...group,
        exports: group.exports.filter((exp) => {
          if (!query) return true;
          return (
            exp.name.toLowerCase().includes(query) || exp.description?.toLowerCase().includes(query)
          );
        }),
      }))
      .filter((group) => group.exports.length > 0);
  }, [allGroups, searchQuery, activeFilter]);

  const availableKinds = useMemo(() => allGroups.map((g) => g.kind), [allGroups]);
  const totalExports = filteredGroups.reduce((sum, g) => sum + g.exports.length, 0);

  return (
    <div className={cn('doccov-index-page space-y-8 not-prose', className)}>
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-3">
          {spec.meta.name || 'API Reference'}
        </h1>
        {(description || spec.meta.description) && (
          <p className="text-muted-foreground text-lg leading-relaxed max-w-3xl">
            {description || spec.meta.description}
          </p>
        )}
      </div>

      {(showSearch || showFilters) && (
        <div className="space-y-4">
          {showSearch && (
            <div className="relative max-w-md">
              <Search
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <input
                type="text"
                placeholder="Search exports..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={cn(
                  'w-full pl-10 pr-4 py-2 rounded-lg',
                  'border border-border bg-background',
                  'text-sm text-foreground placeholder:text-muted-foreground',
                  'focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent',
                  'transition-shadow',
                )}
              />
            </div>
          )}

          {showFilters && availableKinds.length > 1 && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setActiveFilter('all')}
                className={cn(
                  'px-3 py-1.5 text-sm rounded-md transition-all cursor-pointer',
                  activeFilter === 'all'
                    ? 'bg-primary text-primary-foreground font-medium'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground',
                )}
              >
                All
              </button>
              {availableKinds.map((kind) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => setActiveFilter(kind)}
                  className={cn(
                    'px-3 py-1.5 text-sm rounded-md transition-all cursor-pointer',
                    activeFilter === kind
                      ? 'bg-primary text-primary-foreground font-medium'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground',
                  )}
                >
                  {KIND_LABELS[kind]}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {(searchQuery || activeFilter !== 'all') && (
        <p className="text-sm text-muted-foreground">
          {totalExports} {totalExports === 1 ? 'result' : 'results'}
          {searchQuery && ` for "${searchQuery}"`}
        </p>
      )}

      {filteredGroups.map((group) => (
        <section key={group.kind}>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4">
            {group.label}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {group.exports.map((exp) => (
              <ExportCard
                key={exp.id}
                name={exp.name}
                description={exp.description}
                href={`${baseHref}/${KIND_SLUGS[group.kind]}/${exp.id}`}
                kind={exp.kind as ExportKind}
              />
            ))}
          </div>
        </section>
      ))}

      {filteredGroups.length === 0 && (
        <div className="rounded-lg border border-border bg-card/50 p-8 text-center">
          <p className="text-muted-foreground">
            {searchQuery || activeFilter !== 'all'
              ? 'No exports match your search.'
              : 'No exports found in this package.'}
          </p>
          {(searchQuery || activeFilter !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setActiveFilter('all');
              }}
              className="mt-3 text-sm text-primary hover:underline cursor-pointer"
            >
              Clear filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}
