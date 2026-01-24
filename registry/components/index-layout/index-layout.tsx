'use client';

import type { OpenPkg, SpecExport } from '@openpkg-ts/spec';

// Install export-card via: openpkg docs add export-card
// import { ExportCard } from '@/components/api/export-card';

export interface IndexLayoutProps {
  /** The OpenPkg spec data */
  spec: OpenPkg;
  /** Custom className */
  className?: string;
  /** Base path for export links (default: /api) */
  basePath?: string;
  /** Custom card renderer */
  renderCard?: (exp: SpecExport, href: string) => React.ReactNode;
}

/**
 * Default export card placeholder.
 * Replace with ExportCard component once installed.
 */
function DefaultCard({ exp, href }: { exp: SpecExport; href: string }) {
  return (
    <a
      href={href}
      className="block p-4 border rounded-lg hover:bg-muted transition-colors group"
    >
      <h3 className="font-semibold font-mono group-hover:underline">{exp.name}</h3>
      <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
        {exp.description || 'No description'}
      </p>
      <span className="text-xs bg-muted px-2 py-0.5 rounded mt-2 inline-block">{exp.kind}</span>
    </a>
  );
}

/**
 * API Reference Index Layout.
 * Shows cards linking to individual export pages.
 * Best for docs frameworks with file-based routing.
 *
 * @example
 * ```tsx
 * import spec from './openpkg.json';
 * import { IndexLayout } from '@/components/api/index-layout';
 *
 * export default function APIIndex() {
 *   return <IndexLayout spec={spec} basePath="/docs/api" />;
 * }
 * ```
 */
export function IndexLayout({
  spec,
  className,
  basePath = '/api',
  renderCard,
}: IndexLayoutProps): React.ReactNode {
  const exports = spec.exports;

  // Group by kind
  const groups = [
    { title: 'Functions', kind: 'function', items: exports.filter((e) => e.kind === 'function') },
    { title: 'Classes', kind: 'class', items: exports.filter((e) => e.kind === 'class') },
    {
      title: 'Types & Interfaces',
      kind: 'interface',
      items: exports.filter((e) => e.kind === 'interface' || e.kind === 'type'),
    },
    { title: 'Variables', kind: 'variable', items: exports.filter((e) => e.kind === 'variable') },
    { title: 'Enums', kind: 'enum', items: exports.filter((e) => e.kind === 'enum') },
  ].filter((g) => g.items.length > 0);

  return (
    <div className={className}>
      {/* Header */}
      <header className="mb-12">
        <h1 className="text-3xl font-bold">{spec.meta.name}</h1>
        {spec.meta.description && (
          <p className="text-lg text-muted-foreground mt-2">{spec.meta.description}</p>
        )}
        {spec.meta.version && <p className="text-sm text-muted-foreground">v{spec.meta.version}</p>}
      </header>

      {/* Grouped cards */}
      {groups.map((group) => (
        <section key={group.kind} className="mb-12">
          <h2 className="text-2xl font-bold mb-6">{group.title}</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {group.items.map((exp) => {
              const href = `${basePath}/${exp.name}`;
              return renderCard ? (
                <div key={exp.id}>{renderCard(exp, href)}</div>
              ) : (
                <DefaultCard key={exp.id} exp={exp} href={href} />
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
