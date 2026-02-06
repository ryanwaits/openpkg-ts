'use client';

import { type ReactNode, useMemo, useState } from 'react';
import { useSpecData } from '../data-context';

interface Props {
  props: {
    baseHref?: string | null;
    showSearch?: boolean | null;
    showFilters?: boolean | null;
  };
  children?: ReactNode;
}

export function ExportIndexPageWrapper({ props, children }: Props) {
  const data = useSpecData();
  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState<string | null>(null);

  const kinds = useMemo(() => Object.keys(data.exportsByKind).sort(), [data.exportsByKind]);

  const filtered = useMemo(() => {
    let exports = data.allExportIds.map((id) => data.exports[id]);
    if (kindFilter) exports = exports.filter((e) => e.kind === kindFilter);
    if (search) {
      const q = search.toLowerCase();
      exports = exports.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.description?.toLowerCase().includes(q),
      );
    }
    return exports;
  }, [data, search, kindFilter]);

  return (
    <div className="max-w-5xl mx-auto py-8 px-6">
      <h1 className="text-3xl font-semibold mb-2">{data.packageName}</h1>
      {data.packageDescription && (
        <p className="text-muted-foreground mb-6">{data.packageDescription}</p>
      )}

      {(props.showSearch ?? true) && (
        <input
          type="text"
          placeholder="Search exports..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground mb-4"
        />
      )}

      {(props.showFilters ?? true) && kinds.length > 1 && (
        <div className="flex gap-2 mb-6 flex-wrap">
          <button
            type="button"
            onClick={() => setKindFilter(null)}
            className={`px-3 py-1 text-sm rounded-full border cursor-pointer ${
              !kindFilter ? 'bg-primary text-primary-foreground' : 'border-border text-muted-foreground'
            }`}
          >
            All ({data.allExportIds.length})
          </button>
          {kinds.map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() => setKindFilter(kind === kindFilter ? null : kind)}
              className={`px-3 py-1 text-sm rounded-full border cursor-pointer ${
                kindFilter === kind
                  ? 'bg-primary text-primary-foreground'
                  : 'border-border text-muted-foreground'
              }`}
            >
              {kind} ({data.exportsByKind[kind].length})
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((exp) => {
          const href = props.baseHref ? `${props.baseHref}#${exp.id}` : `#${exp.id}`;
          return (
            <a
              key={exp.id}
              href={href}
              className="block p-4 border border-border rounded-lg hover:border-primary/50 transition-colors"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">
                  {exp.kind}
                </span>
              </div>
              <h3 className="font-mono text-sm font-medium">{exp.title}</h3>
              {exp.description && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {exp.description}
                </p>
              )}
            </a>
          );
        })}
      </div>
      {children}
    </div>
  );
}
