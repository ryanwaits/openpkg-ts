'use client';

import type { OpenPkg, SpecExport } from '@openpkg-ts/spec';
import { type ReactNode, useMemo, useState } from 'react';
import { type ExportKind, KIND_LABELS, groupExportsByKind } from '../shared';
import { ExportCard } from './ExportCard';

export interface ExportIndexPageProps {
  /** OpenPkg spec */
  spec: OpenPkg;
  /** Base href for links (e.g., '/docs/api') */
  baseHref: string;
  /** Optional intro description */
  description?: string;
  /** Custom className */
  className?: string;
  /** Show search input (default: true) */
  showSearch?: boolean;
  /** Show category filter buttons (default: true) */
  showFilters?: boolean;
  /** Custom Link component for cards */
  LinkComponent?: React.ComponentType<{ href: string; className?: string; children: ReactNode }>;
  /** Custom card renderer */
  renderCard?: (exp: SpecExport, href: string) => ReactNode;
  /** Custom search input renderer */
  renderSearch?: (value: string, onChange: (value: string) => void) => ReactNode;
}

/**
 * Headless export index page with search and filtering.
 * Groups exports by kind in a responsive grid layout.
 *
 * @example
 * ```tsx
 * <ExportIndexPage
 *   spec={spec}
 *   baseHref="/docs/api"
 *   LinkComponent={NextLink}
 * />
 * ```
 */
export function ExportIndexPage({
  spec,
  baseHref,
  description,
  className,
  showSearch = true,
  showFilters = true,
  LinkComponent,
  renderCard,
  renderSearch,
}: ExportIndexPageProps): ReactNode {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<ExportKind | 'all'>('all');

  const allGroups = useMemo(() => groupExportsByKind(spec.exports), [spec.exports]);

  // Filter by search and category
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
  const isFiltering = searchQuery || activeFilter !== 'all';

  return (
    <div className={className} data-component="export-index-page">
      {/* Header */}
      <header data-slot="header">
        <h1 data-slot="title">{spec.meta.name || 'API Reference'}</h1>
        {(description || spec.meta.description) && (
          <p data-slot="description">{description || spec.meta.description}</p>
        )}
      </header>

      {/* Controls */}
      {(showSearch || showFilters) && (
        <div data-slot="controls">
          {/* Search */}
          {showSearch && (
            <div data-slot="search">
              {renderSearch ? (
                renderSearch(searchQuery, setSearchQuery)
              ) : (
                <input
                  type="text"
                  placeholder="Search exports..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  data-slot="search-input"
                />
              )}
            </div>
          )}

          {/* Filter buttons */}
          {showFilters && availableKinds.length > 1 && (
            <div data-slot="filters" role="group" aria-label="Filter by kind">
              <button
                type="button"
                onClick={() => setActiveFilter('all')}
                data-active={activeFilter === 'all'}
                data-slot="filter-button"
              >
                All
              </button>
              {availableKinds.map((kind) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => setActiveFilter(kind)}
                  data-active={activeFilter === kind}
                  data-kind={kind}
                  data-slot="filter-button"
                >
                  {KIND_LABELS[kind]}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Results count */}
      {isFiltering && (
        <p data-slot="results-count">
          {totalExports} {totalExports === 1 ? 'result' : 'results'}
          {searchQuery && ` for "${searchQuery}"`}
        </p>
      )}

      {/* Groups */}
      <div data-slot="groups">
        {filteredGroups.map((group) => (
          <section key={group.kind} data-slot="group" data-kind={group.kind}>
            <h2 data-slot="group-title">{group.label}</h2>
            <div data-slot="grid">
              {group.exports.map((exp) => {
                const href = `${baseHref}/${group.slug}/${exp.id}`;
                return renderCard ? (
                  renderCard(exp, href)
                ) : (
                  <ExportCard
                    key={exp.id}
                    name={exp.name}
                    description={exp.description}
                    href={href}
                    kind={exp.kind as ExportKind}
                    LinkComponent={LinkComponent}
                  />
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {/* Empty state */}
      {filteredGroups.length === 0 && (
        <div data-slot="empty">
          <p>
            {isFiltering ? 'No exports match your search.' : 'No exports found in this package.'}
          </p>
          {isFiltering && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setActiveFilter('all');
              }}
              data-slot="clear-button"
            >
              Clear filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}
