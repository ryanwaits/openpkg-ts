'use client';

import {
  buildImportStatement,
  getLangForHighlight,
  specExamplesToCodeExamples,
} from '@openpkg-ts/sdk/browser';
import type { OpenPkg, SpecExport } from '@openpkg-ts/spec';
import { APIParameterItem, APISection, ParameterList } from '@/registry/new-york/docskit/api';
import type { ReactNode } from 'react';

export interface EnumSectionProps {
  export: SpecExport;
  spec: OpenPkg;
}

export function EnumSection({ export: exp, spec }: EnumSectionProps): ReactNode {
  const members = exp.members ?? [];

  const examples = specExamplesToCodeExamples(exp.examples);
  const importStatement = buildImportStatement(exp, spec);

  const enumDefinition =
    members.length > 0
      ? `enum ${exp.name} {\n${members
          .map((m) => {
            const value =
              m.schema !== undefined
                ? typeof m.schema === 'object' && m.schema !== null
                  ? ((m.schema as Record<string, unknown>).const ??
                    (m.schema as Record<string, unknown>).default)
                  : m.schema
                : undefined;
            return `  ${m.name}${value !== undefined ? ` = ${JSON.stringify(value)}` : ''},`;
          })
          .join('\n')}\n}`
      : `enum ${exp.name} { }`;

  const displayExamples =
    examples.length > 0
      ? examples
      : [
          {
            id: 'default',
            label: 'TypeScript',
            code: `${importStatement}\n\n${enumDefinition}`,
            language: getLangForHighlight('typescript'),
          },
        ];

  return (
    <APISection
      id={exp.id || exp.name}
      title={`enum ${exp.name}`}
      description={
        <div className="space-y-3">
          {exp.description && <p>{exp.description}</p>}
          {exp.deprecated && (
            <div className="rounded-md bg-[color-mix(in_srgb,var(--openpkg-accent-yellow)_10%,transparent)] border border-[color-mix(in_srgb,var(--openpkg-accent-yellow)_20%,transparent)] px-3 py-2 text-sm text-[var(--openpkg-accent-yellow)]">
              <strong>Deprecated:</strong> This export is deprecated.
            </div>
          )}
          <code className="text-sm font-mono bg-[var(--openpkg-bg-badge)] px-2 py-1 rounded inline-block">
            {importStatement}
          </code>
        </div>
      }
      examples={displayExamples}
      codePanelTitle={exp.name}
    >
      {members.length > 0 && (
        <ParameterList title="Members">
          {members.map((member, index) => {
            const value =
              member.schema !== undefined
                ? typeof member.schema === 'object' && member.schema !== null
                  ? ((member.schema as Record<string, unknown>).const ??
                    (member.schema as Record<string, unknown>).default ??
                    undefined)
                  : member.schema
                : undefined;

            return (
              <APIParameterItem
                key={member.name ?? index}
                name={member.name}
                type={value !== undefined ? String(value) : 'auto'}
                description={member.description}
              />
            );
          })}
        </ParameterList>
      )}
    </APISection>
  );
}
