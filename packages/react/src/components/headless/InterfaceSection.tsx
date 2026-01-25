'use client';

import { formatSchema } from '@openpkg-ts/sdk/browser';
import type { OpenPkg, SpecExport, SpecMember } from '@openpkg-ts/spec';
import type { ReactNode } from 'react';

export interface InterfaceSectionProps {
  export: SpecExport;
  spec: OpenPkg;
  className?: string;
  /** Custom property row renderer */
  renderProperty?: (prop: SpecMember, index: number) => ReactNode;
}

/** Format method signature for display */
function formatMethodSignature(member: SpecMember): string {
  const sig = member.signatures?.[0];
  const params = sig?.parameters ?? [];
  const returnType = formatSchema(sig?.returns?.schema);
  const paramStr = params
    .map((p) => `${p.name}${p.required === false ? '?' : ''}: ${formatSchema(p.schema)}`)
    .join(', ');
  return `(${paramStr}): ${returnType}`;
}

/**
 * Headless interface/type documentation section.
 * Renders properties and methods.
 */
export function InterfaceSection({
  export: exp,
  spec,
  className,
  renderProperty,
}: InterfaceSectionProps): ReactNode {
  const properties =
    exp.members?.filter((m) => m.kind === 'property' || m.kind === 'field' || !m.kind) ?? [];
  const methods = exp.members?.filter((m) => m.kind === 'method' || m.kind === 'function') ?? [];

  const pkgName = spec.meta.name;
  const importStatement = `import type { ${exp.name} } from '${pkgName}';`;
  const kindLabel = exp.kind === 'type' ? 'type' : 'interface';

  // Build type definition
  const typeDefinition =
    properties.length > 0
      ? `${kindLabel} ${exp.name} {\n${properties.map((p) => `  ${p.name}${p.required === false ? '?' : ''}: ${formatSchema(p.schema)};`).join('\n')}\n}`
      : `${kindLabel} ${exp.name} { }`;

  return (
    <section
      className={className}
      data-component="interface-section"
      data-export={exp.name}
      data-kind={exp.kind}
    >
      {/* Header */}
      <header data-slot="header">
        <h2 data-slot="title">
          {kindLabel} {exp.name}
        </h2>
        {exp.extends && (
          <p data-slot="extends">
            <code>extends {exp.extends}</code>
          </p>
        )}
        {exp.description && <p data-slot="description">{exp.description}</p>}
        {exp.deprecated && (
          <p data-slot="deprecated" data-deprecated="true">
            <strong>Deprecated:</strong> This export is deprecated.
            {exp.deprecationReason && ` ${exp.deprecationReason}`}
          </p>
        )}
        <code data-slot="import">{importStatement}</code>
      </header>

      {/* Properties */}
      {properties.length > 0 && (
        <div data-slot="properties">
          <h3>Properties</h3>
          <table>
            <thead>
              <tr>
                <th>Property</th>
                <th>Type</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {properties.map((prop, index) =>
                renderProperty ? (
                  renderProperty(prop, index)
                ) : (
                  <tr key={prop.name ?? index} data-required={prop.required !== false}>
                    <td>
                      <code>{prop.name}</code>
                      {prop.required === false && <span data-badge="optional">?</span>}
                    </td>
                    <td>
                      <code>{formatSchema(prop.schema)}</code>
                    </td>
                    <td>{prop.description}</td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Methods */}
      {methods.length > 0 && (
        <div data-slot="methods">
          <h3>Methods</h3>
          <table>
            <thead>
              <tr>
                <th>Method</th>
                <th>Signature</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {methods.map((method, index) => (
                <tr key={method.name ?? index}>
                  <td>
                    <code>{method.name}()</code>
                  </td>
                  <td>
                    <code>{formatMethodSignature(method)}</code>
                  </td>
                  <td>{method.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Example */}
      <div data-slot="example">
        <h3>Definition</h3>
        <pre>
          <code>{`${importStatement}\n\n${typeDefinition}`}</code>
        </pre>
      </div>
    </section>
  );
}
