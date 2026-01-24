'use client';

import { formatSchema } from '@openpkg-ts/sdk/browser';
import type { OpenPkg, SpecExport } from '@openpkg-ts/spec';
import type { ReactNode } from 'react';

export interface VariableSectionProps {
  export: SpecExport;
  spec: OpenPkg;
  className?: string;
}

/**
 * Headless variable/constant documentation section.
 * Renders type information and value.
 */
export function VariableSection({
  export: exp,
  spec,
  className,
}: VariableSectionProps): ReactNode {
  const typeValue = typeof exp.type === 'string' ? exp.type : formatSchema(exp.schema);
  const pkgName = spec.meta.name;
  const importStatement = `import { ${exp.name} } from '${pkgName}';`;

  // Get const value if available
  const constValue =
    exp.schema && typeof exp.schema === 'object'
      ? (exp.schema as Record<string, unknown>).const
      : undefined;

  return (
    <section className={className} data-component="variable-section" data-export={exp.name}>
      {/* Header */}
      <header data-slot="header">
        <h2 data-slot="title">const {exp.name}</h2>
        {exp.description && <p data-slot="description">{exp.description}</p>}
        {exp.deprecated && (
          <p data-slot="deprecated" data-deprecated="true">
            <strong>Deprecated:</strong> This export is deprecated.
            {exp.deprecationReason && ` ${exp.deprecationReason}`}
          </p>
        )}
        <code data-slot="import">{importStatement}</code>
      </header>

      {/* Type */}
      <div data-slot="type">
        <h3>Type</h3>
        <dl>
          <dt><code>{exp.name}</code></dt>
          <dd>
            <code>{typeValue}</code>
            {constValue !== undefined && (
              <span data-slot="value"> = {JSON.stringify(constValue)}</span>
            )}
          </dd>
        </dl>
      </div>

      {/* Example */}
      <div data-slot="example">
        <h3>Example</h3>
        <pre><code>{`${importStatement}\n\nconsole.log(${exp.name}); // ${constValue !== undefined ? JSON.stringify(constValue) : typeValue}`}</code></pre>
      </div>
    </section>
  );
}
