'use client';

import type { OpenPkg, SpecExport } from '@openpkg-ts/spec';

// Install section components via: openpkg docs add function-section class-section
// import { FunctionSection } from '@/components/api/function-section';
// import { ClassSection } from '@/components/api/class-section';
// import { InterfaceSection } from '@/components/api/interface-section';
// import { VariableSection } from '@/components/api/variable-section';
// import { EnumSection } from '@/components/api/enum-section';

export interface FullLayoutProps {
  /** The OpenPkg spec data */
  spec: OpenPkg;
  /** Custom className */
  className?: string;
  /** Custom section renderer */
  renderSection?: (exp: SpecExport) => React.ReactNode;
}

/**
 * Renders a single export section.
 * Replace with component imports once installed.
 */
function ExportSection({ exp, spec }: { exp: SpecExport; spec: OpenPkg }) {
  // Uncomment once you've installed section components:
  // switch (exp.kind) {
  //   case 'function':
  //     return <FunctionSection export={exp} spec={spec} />;
  //   case 'class':
  //     return <ClassSection export={exp} spec={spec} />;
  //   case 'interface':
  //   case 'type':
  //     return <InterfaceSection export={exp} spec={spec} />;
  //   case 'variable':
  //     return <VariableSection export={exp} spec={spec} />;
  //   case 'enum':
  //     return <EnumSection export={exp} spec={spec} />;
  //   default:
  //     return null;
  // }

  // Placeholder - replace with components above
  return (
    <section id={exp.id} className="py-8 border-b last:border-b-0">
      <h3 className="text-lg font-semibold font-mono">{exp.name}</h3>
      <p className="text-muted-foreground mt-1">{exp.description || 'No description'}</p>
      <span className="text-xs bg-muted px-2 py-0.5 rounded mt-2 inline-block">{exp.kind}</span>
    </section>
  );
}

/**
 * Full API Reference Layout.
 * Renders all exports on a single page, grouped by kind.
 *
 * @example
 * ```tsx
 * import spec from './openpkg.json';
 * import { FullLayout } from '@/components/api/full-layout';
 *
 * export default function APIPage() {
 *   return <FullLayout spec={spec} />;
 * }
 * ```
 */
export function FullLayout({ spec, className, renderSection }: FullLayoutProps): React.ReactNode {
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

      {/* Grouped sections */}
      {groups.map((group) => (
        <section key={group.kind} className="mb-12">
          <h2 className="text-2xl font-bold mb-6">{group.title}</h2>
          <div className="space-y-0">
            {group.items.map((exp) =>
              renderSection ? (
                <div key={exp.id}>{renderSection(exp)}</div>
              ) : (
                <ExportSection key={exp.id} exp={exp} spec={spec} />
              ),
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
