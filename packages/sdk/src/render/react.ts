/**
 * React layout generator for OpenPkg specs.
 * Generates a single layout file that renders the spec using registry components.
 *
 * Components are added separately via `openpkg docs add <component>`.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { OpenPkg } from '@openpkg-ts/spec';

export interface ReactLayoutOptions {
  /** Output directory for generated files */
  outDir: string;
  /** Layout variant: 'full' (single page) or 'index' (export index with links) */
  variant?: 'full' | 'index';
  /** Components path alias (default: @/components/api) */
  componentsPath?: string;
}

/**
 * Generate full API reference layout.
 * Renders all exports on a single page grouped by kind.
 */
function generateFullLayout(spec: OpenPkg, componentsPath: string): string {
  const pkgName = spec.meta.name;

  return `'use client';

import type { OpenPkg, SpecExport } from '@openpkg-ts/spec';
import spec from './openpkg.json';

// Add components via: openpkg docs add function-section class-section interface-section
// Then uncomment the imports below and customize as needed.

// import { FunctionSection } from '${componentsPath}/function-section';
// import { ClassSection } from '${componentsPath}/class-section';
// import { InterfaceSection } from '${componentsPath}/interface-section';
// import { VariableSection } from '${componentsPath}/variable-section';
// import { EnumSection } from '${componentsPath}/enum-section';

/**
 * Renders a single export based on its kind.
 * Customize this to match your design system.
 */
function ExportSection({ exp }: { exp: SpecExport }) {
  // Uncomment the switch once you've added components:
  // switch (exp.kind) {
  //   case 'function':
  //     return <FunctionSection key={exp.id} export={exp} spec={spec as OpenPkg} />;
  //   case 'class':
  //     return <ClassSection key={exp.id} export={exp} spec={spec as OpenPkg} />;
  //   case 'interface':
  //   case 'type':
  //     return <InterfaceSection key={exp.id} export={exp} spec={spec as OpenPkg} />;
  //   case 'variable':
  //     return <VariableSection key={exp.id} export={exp} spec={spec as OpenPkg} />;
  //   case 'enum':
  //     return <EnumSection key={exp.id} export={exp} spec={spec as OpenPkg} />;
  //   default:
  //     return null;
  // }

  // Placeholder: replace with component imports above
  return (
    <section id={exp.id} className="py-8 border-b">
      <h2 className="text-xl font-semibold">{exp.name}</h2>
      <p className="text-muted-foreground">{exp.description || 'No description'}</p>
      <code className="text-sm">{exp.kind}</code>
    </section>
  );
}

/**
 * Full API Reference Page for ${pkgName}
 *
 * This layout renders all exports on a single page.
 * Customize the grouping, styling, and components to match your docs.
 */
export default function APIReferencePage() {
  const typedSpec = spec as OpenPkg;
  const exports = typedSpec.exports;

  // Group exports by kind
  const functions = exports.filter((e) => e.kind === 'function');
  const classes = exports.filter((e) => e.kind === 'class');
  const interfaces = exports.filter((e) => e.kind === 'interface' || e.kind === 'type');
  const variables = exports.filter((e) => e.kind === 'variable');
  const enums = exports.filter((e) => e.kind === 'enum');

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <header className="mb-12">
        <h1 className="text-3xl font-bold">{typedSpec.meta.name}</h1>
        {typedSpec.meta.description && (
          <p className="text-lg text-muted-foreground mt-2">{typedSpec.meta.description}</p>
        )}
        {typedSpec.meta.version && (
          <p className="text-sm text-muted-foreground">v{typedSpec.meta.version}</p>
        )}
      </header>

      {functions.length > 0 && (
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-6">Functions</h2>
          {functions.map((exp) => (
            <ExportSection key={exp.id} exp={exp} />
          ))}
        </section>
      )}

      {classes.length > 0 && (
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-6">Classes</h2>
          {classes.map((exp) => (
            <ExportSection key={exp.id} exp={exp} />
          ))}
        </section>
      )}

      {interfaces.length > 0 && (
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-6">Types & Interfaces</h2>
          {interfaces.map((exp) => (
            <ExportSection key={exp.id} exp={exp} />
          ))}
        </section>
      )}

      {variables.length > 0 && (
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-6">Variables</h2>
          {variables.map((exp) => (
            <ExportSection key={exp.id} exp={exp} />
          ))}
        </section>
      )}

      {enums.length > 0 && (
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-6">Enums</h2>
          {enums.map((exp) => (
            <ExportSection key={exp.id} exp={exp} />
          ))}
        </section>
      )}
    </div>
  );
}

export { spec };
`;
}

/**
 * Generate index layout with cards linking to individual exports.
 * Best for docs frameworks that use file-based routing.
 */
function generateIndexLayout(spec: OpenPkg, componentsPath: string): string {
  const pkgName = spec.meta.name;

  return `'use client';

import type { OpenPkg } from '@openpkg-ts/spec';
import spec from './openpkg.json';

// Add the export-card component: openpkg docs add export-card
// import { ExportCard } from '${componentsPath}/export-card';

/**
 * API Reference Index Page for ${pkgName}
 *
 * Links to individual export pages. Best with file-based routing.
 * Customize the card component and links to match your docs.
 */
export default function APIReferenceIndex() {
  const typedSpec = spec as OpenPkg;
  const exports = typedSpec.exports;

  // Group exports by kind
  const groups = [
    { title: 'Functions', items: exports.filter((e) => e.kind === 'function') },
    { title: 'Classes', items: exports.filter((e) => e.kind === 'class') },
    { title: 'Types & Interfaces', items: exports.filter((e) => e.kind === 'interface' || e.kind === 'type') },
    { title: 'Variables', items: exports.filter((e) => e.kind === 'variable') },
    { title: 'Enums', items: exports.filter((e) => e.kind === 'enum') },
  ].filter((g) => g.items.length > 0);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <header className="mb-12">
        <h1 className="text-3xl font-bold">{typedSpec.meta.name}</h1>
        {typedSpec.meta.description && (
          <p className="text-lg text-muted-foreground mt-2">{typedSpec.meta.description}</p>
        )}
      </header>

      {groups.map((group) => (
        <section key={group.title} className="mb-12">
          <h2 className="text-2xl font-bold mb-6">{group.title}</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {group.items.map((exp) => (
              // Replace with ExportCard once installed:
              // <ExportCard key={exp.id} export={exp} href={\`/api/\${exp.name}\`} />
              <a
                key={exp.id}
                href={\`/api/\${exp.name}\`}
                className="block p-4 border rounded-lg hover:bg-muted transition-colors"
              >
                <h3 className="font-semibold">{exp.name}</h3>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {exp.description || 'No description'}
                </p>
                <span className="text-xs bg-muted px-2 py-1 rounded mt-2 inline-block">
                  {exp.kind}
                </span>
              </a>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export { spec };
`;
}

/**
 * Generate React layout from an OpenPkg spec.
 *
 * Unlike the old per-export approach, this generates a single layout file.
 * Components are installed separately via the registry.
 */
export async function toReact(spec: OpenPkg, options: ReactLayoutOptions): Promise<void> {
  const { outDir, variant = 'full', componentsPath = '@/components/api' } = options;

  // Ensure output directory exists
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  // Write spec.json for the layout to import
  const specPath = path.join(outDir, 'openpkg.json');
  fs.writeFileSync(specPath, JSON.stringify(spec, null, 2));

  // Generate layout file
  const layoutContent =
    variant === 'index'
      ? generateIndexLayout(spec, componentsPath)
      : generateFullLayout(spec, componentsPath);

  const layoutPath = path.join(outDir, 'page.tsx');
  fs.writeFileSync(layoutPath, layoutContent);
}

/**
 * Generate layout code as a string (for preview).
 */
export function toReactString(
  spec: OpenPkg,
  options: { variant?: 'full' | 'index'; componentsPath?: string } = {},
): string {
  const { variant = 'full', componentsPath = '@/components/api' } = options;
  return variant === 'index'
    ? generateIndexLayout(spec, componentsPath)
    : generateFullLayout(spec, componentsPath);
}
