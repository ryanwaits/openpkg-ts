'use client';

import { formatSchema } from '@openpkg-ts/sdk/browser';
import type { OpenPkg, SpecExport, SpecMember } from '@openpkg-ts/spec';
import { APIParameterItem, APISection, ParameterList } from '@openpkg-ts/ui/docskit';
import type { ReactNode } from 'react';
import {
  buildImportStatement,
  getLanguagesFromExamples,
  specExamplesToCodeExamples,
  specSchemaToAPISchema,
} from './spec-to-docskit';

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

  const languages = getLanguagesFromExamples(exp.examples);
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
            languageId: 'typescript',
            code: `${importStatement}\n\n${typeDefinition}`,
            highlightLang: 'ts',
          },
        ];

  const displayLanguages =
    languages.length > 0 ? languages : [{ id: 'typescript', label: 'TypeScript' }];

  const kindLabel = exp.kind === 'type' ? 'type' : 'interface';

  return (
    <APISection
      id={exp.id || exp.name}
      title={`${kindLabel} ${exp.name}`}
      description={
        <div className="space-y-3">
          {exp.extends && (
            <p className="font-mono text-sm text-muted-foreground">extends {exp.extends}</p>
          )}
          {exp.description && <p>{exp.description}</p>}
          {exp.deprecated && (
            <div className="rounded-md bg-yellow-500/10 border border-yellow-500/20 px-3 py-2 text-sm text-yellow-600 dark:text-yellow-400">
              <strong>Deprecated:</strong> This export is deprecated.
            </div>
          )}
          <code className="text-sm font-mono bg-muted px-2 py-1 rounded inline-block">
            {importStatement}
          </code>
        </div>
      }
      languages={displayLanguages}
      examples={displayExamples}
      codePanelTitle={exp.name}
    >
      {properties.length > 0 && (
        <ParameterList title="Properties">
          {properties.map((prop, index) => {
            const type = formatSchema(prop.schema);
            const children = specSchemaToAPISchema(prop.schema);
            const hasNestedProperties =
              children?.properties && Object.keys(children.properties).length > 0;

            return (
              <APIParameterItem
                key={prop.name ?? index}
                name={prop.name}
                type={type}
                description={buildMemberDescription(prop)}
                children={hasNestedProperties ? children : undefined}
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
