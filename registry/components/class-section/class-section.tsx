'use client';

import { formatSchema } from '@openpkg-ts/sdk/browser';
import type { OpenPkg, SpecExport, SpecMember } from '@openpkg-ts/spec';
import type { ReactNode } from 'react';

export interface ClassSectionProps {
  export: SpecExport;
  spec: OpenPkg;
  className?: string;
  /** Custom member row renderer */
  renderMember?: (member: SpecMember, kind: 'property' | 'method') => ReactNode;
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

/** Get visibility/modifier badges */
function getMemberBadges(member: SpecMember): string[] {
  const badges: string[] = [];
  const flags = member.flags as Record<string, boolean> | undefined;

  if (member.visibility && member.visibility !== 'public') badges.push(member.visibility);
  if (flags?.static) badges.push('static');
  if (flags?.readonly) badges.push('readonly');
  if (flags?.async) badges.push('async');
  if (flags?.abstract) badges.push('abstract');

  return badges;
}

/**
 * Headless class documentation section.
 * Renders constructor, static members, methods, and properties.
 */
export function ClassSection({
  export: exp,
  spec,
  className,
  renderMember,
}: ClassSectionProps): ReactNode {
  const constructors = exp.members?.filter((m) => m.kind === 'constructor') ?? [];
  const properties = exp.members?.filter((m) => m.kind === 'property' || m.kind === 'field') ?? [];
  const methods = exp.members?.filter((m) => m.kind === 'method') ?? [];

  // Separate static and instance members
  const staticProperties = properties.filter((m) => (m.flags as Record<string, boolean>)?.static);
  const instanceProperties = properties.filter((m) => !(m.flags as Record<string, boolean>)?.static);
  const staticMethods = methods.filter((m) => (m.flags as Record<string, boolean>)?.static);
  const instanceMethods = methods.filter((m) => !(m.flags as Record<string, boolean>)?.static);

  const constructorSig = constructors[0]?.signatures?.[0];
  const constructorParams = constructorSig?.parameters ?? [];

  // Build import statement
  const pkgName = spec.meta.name;
  const importStatement = `import { ${exp.name} } from '${pkgName}';`;

  // Build inheritance info
  const inheritance = [
    exp.extends && `extends ${exp.extends}`,
    exp.implements?.length && `implements ${exp.implements.join(', ')}`,
  ]
    .filter(Boolean)
    .join(' ');

  const renderMemberRow = (member: SpecMember, kind: 'property' | 'method') => {
    if (renderMember) return renderMember(member, kind);

    const badges = getMemberBadges(member);
    const isMethod = kind === 'method';

    return (
      <tr key={member.name} data-visibility={member.visibility} data-badges={badges.join(',')}>
        <td>
          <code>{member.name}{isMethod ? '()' : ''}</code>
          {badges.map((b) => (
            <span key={b} data-badge={b}>{b}</span>
          ))}
        </td>
        <td>
          <code>{isMethod ? formatMethodSignature(member) : formatSchema(member.schema)}</code>
        </td>
        <td>{member.description}</td>
      </tr>
    );
  };

  return (
    <section className={className} data-component="class-section" data-export={exp.name}>
      {/* Header */}
      <header data-slot="header">
        <h2 data-slot="title">class {exp.name}</h2>
        {inheritance && <p data-slot="inheritance"><code>{inheritance}</code></p>}
        {exp.description && <p data-slot="description">{exp.description}</p>}
        <code data-slot="import">{importStatement}</code>
      </header>

      {/* Constructor */}
      {constructorParams.length > 0 && (
        <div data-slot="constructor">
          <h3>Constructor</h3>
          <table>
            <thead>
              <tr>
                <th>Parameter</th>
                <th>Type</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {constructorParams.map((param, index) => (
                <tr key={param.name ?? index} data-required={param.required}>
                  <td>
                    <code>{param.name}</code>
                    {param.required === false && <span data-badge="optional">?</span>}
                  </td>
                  <td><code>{formatSchema(param.schema)}</code></td>
                  <td>{param.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Static Members */}
      {(staticProperties.length > 0 || staticMethods.length > 0) && (
        <div data-slot="static-members">
          <h3>Static Members</h3>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {staticProperties.map((m) => renderMemberRow(m, 'property'))}
              {staticMethods.map((m) => renderMemberRow(m, 'method'))}
            </tbody>
          </table>
        </div>
      )}

      {/* Methods */}
      {instanceMethods.length > 0 && (
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
              {instanceMethods.map((m) => renderMemberRow(m, 'method'))}
            </tbody>
          </table>
        </div>
      )}

      {/* Properties */}
      {instanceProperties.length > 0 && (
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
              {instanceProperties.map((m) => renderMemberRow(m, 'property'))}
            </tbody>
          </table>
        </div>
      )}

      {/* Example */}
      <div data-slot="example">
        <h3>Example</h3>
        <pre><code>{`${importStatement}\n\nconst instance = new ${exp.name}(${constructorParams.map((p) => p.name).join(', ')});`}</code></pre>
      </div>
    </section>
  );
}
