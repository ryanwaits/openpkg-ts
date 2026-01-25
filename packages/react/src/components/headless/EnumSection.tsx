'use client';

import type { OpenPkg, SpecExport, SpecMember } from '@openpkg-ts/spec';
import type { ReactNode } from 'react';

export interface EnumSectionProps {
  export: SpecExport;
  spec: OpenPkg;
  className?: string;
  /** Custom member row renderer */
  renderMember?: (member: SpecMember, index: number) => ReactNode;
}

/** Extract enum member value from schema */
function getMemberValue(member: SpecMember): unknown {
  if (member.schema === undefined) return undefined;
  if (typeof member.schema === 'object' && member.schema !== null) {
    const schema = member.schema as Record<string, unknown>;
    return schema.const ?? schema.default;
  }
  return member.schema;
}

/**
 * Headless enum documentation section.
 * Renders enum members with values.
 */
export function EnumSection({
  export: exp,
  spec,
  className,
  renderMember,
}: EnumSectionProps): ReactNode {
  const members = exp.members ?? [];
  const pkgName = spec.meta.name;
  const importStatement = `import { ${exp.name} } from '${pkgName}';`;

  // Build enum definition
  const enumDefinition =
    members.length > 0
      ? `enum ${exp.name} {\n${members
          .map((m) => {
            const value = getMemberValue(m);
            return `  ${m.name}${value !== undefined ? ` = ${JSON.stringify(value)}` : ''},`;
          })
          .join('\n')}\n}`
      : `enum ${exp.name} { }`;

  return (
    <section className={className} data-component="enum-section" data-export={exp.name}>
      {/* Header */}
      <header data-slot="header">
        <h2 data-slot="title">enum {exp.name}</h2>
        {exp.description && <p data-slot="description">{exp.description}</p>}
        {exp.deprecated && (
          <p data-slot="deprecated" data-deprecated="true">
            <strong>Deprecated:</strong> This export is deprecated.
            {exp.deprecationReason && ` ${exp.deprecationReason}`}
          </p>
        )}
        <code data-slot="import">{importStatement}</code>
      </header>

      {/* Members */}
      {members.length > 0 && (
        <div data-slot="members">
          <h3>Members</h3>
          <table>
            <thead>
              <tr>
                <th>Member</th>
                <th>Value</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member, index) =>
                renderMember ? (
                  renderMember(member, index)
                ) : (
                  <tr key={member.name ?? index}>
                    <td>
                      <code>{member.name}</code>
                    </td>
                    <td>
                      {(() => {
                        const value = getMemberValue(member);
                        return value !== undefined ? (
                          <code>{String(value)}</code>
                        ) : (
                          <span>auto</span>
                        );
                      })()}
                    </td>
                    <td>{member.description}</td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Example */}
      <div data-slot="example">
        <h3>Definition</h3>
        <pre>
          <code>{`${importStatement}\n\n${enumDefinition}`}</code>
        </pre>
      </div>
    </section>
  );
}
