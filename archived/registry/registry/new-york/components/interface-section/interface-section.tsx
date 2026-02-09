'use client';

import {
  buildImportStatement,
  formatSchema,
  getLangForHighlight,
  specExamplesToCodeExamples,
} from '@openpkg-ts/sdk/browser';
import type { OpenPkg, SpecExport, SpecMember } from '@openpkg-ts/spec';
import { APIParameterItem, APISection, ParameterList } from '@/registry/new-york/docskit/api';
import type { ReactNode } from 'react';

export interface InterfaceSectionProps {
  export: SpecExport;
  spec: OpenPkg;
}

function formatMethodSignature(member: SpecMember): string {
  const sig = member.signatures?.[0];
  const params = sig?.parameters ?? [];
  const returnType = formatSchema(sig?.returns?.schema);
  const paramStr = params
    .map((p) => `${p.name}${p.required === false ? '?' : ''}: ${formatSchema(p.schema)}`)
    .join(', ');
  return `(${paramStr}): ${returnType}`;
}

function buildMemberDescription(member: SpecMember): string | undefined {
  const parts: string[] = [];
  if (member.decorators?.length) {
    parts.push(
      member.decorators
        .map((d) => `@${d.name}${d.argumentsText?.length ? `(${d.argumentsText.join(', ')})` : ''}`)
        .join(' '),
    );
  }
  if (member.description) parts.push(member.description);
  return parts.length > 0 ? parts.join(' • ') : undefined;
}

export function InterfaceSection({ export: exp, spec }: InterfaceSectionProps): ReactNode {
  const properties =
    exp.members?.filter((m) => m.kind === 'property' || m.kind === 'field' || !m.kind) ?? [];
  const methods = exp.members?.filter((m) => m.kind === 'method' || m.kind === 'function') ?? [];

  const examples = specExamplesToCodeExamples(exp.examples);
  const importStatement = buildImportStatement(exp, spec);

  const typeDefinition =
    properties.length > 0
      ? `${exp.kind === 'type' ? 'type' : 'interface'} ${exp.name} {\n${properties.map((p) => `  ${p.name}${p.required === false ? '?' : ''}: ${formatSchema(p.schema)};`).join('\n')}\n}`
      : `${exp.kind === 'type' ? 'type' : 'interface'} ${exp.name} { }`;

  const displayExamples =
    examples.length > 0
      ? examples
      : [
          {
            id: 'default',
            label: 'TypeScript',
            code: `${importStatement}\n\n${typeDefinition}`,
            language: getLangForHighlight('typescript'),
          },
        ];

  const kindLabel = exp.kind === 'type' ? 'type' : 'interface';

  return (
    <APISection
      id={exp.id || exp.name}
      title={`${kindLabel} ${exp.name}`}
      description={
        <div className="space-y-3">
          {exp.extends && (
            <p className="font-mono text-sm text-[var(--openpkg-text-muted)]">
              extends {exp.extends}
            </p>
          )}
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
      {properties.length > 0 && (
        <ParameterList title="Properties">
          {properties.map((prop, index) => {
            const type = formatSchema(prop.schema);

            return (
              <APIParameterItem
                key={prop.name ?? index}
                name={prop.name}
                type={type}
                description={buildMemberDescription(prop)}
              />
            );
          })}
        </ParameterList>
      )}

      {methods.length > 0 && (
        <ParameterList title="Methods" className="mt-6">
          {methods.map((method, index) => (
            <APIParameterItem
              key={method.name ?? index}
              name={`${method.name}()`}
              type={formatMethodSignature(method)}
              description={buildMemberDescription(method)}
            />
          ))}
        </ParameterList>
      )}
    </APISection>
  );
}
