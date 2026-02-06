'use client';

import {
  buildImportStatement,
  formatSchema,
  getLangForHighlight,
  specExamplesToCodeExamples,
} from '@openpkg-ts/sdk/browser';
import type { OpenPkg, SpecExport } from '@openpkg-ts/spec';
import { APIParameterItem, APISection, ParameterList } from '@/registry/new-york/docskit/api';
import type { ReactNode } from 'react';

export interface VariableSectionProps {
  export: SpecExport;
  spec: OpenPkg;
}

export function VariableSection({ export: exp, spec }: VariableSectionProps): ReactNode {
  const typeValue = typeof exp.type === 'string' ? exp.type : formatSchema(exp.schema);

  const examples = specExamplesToCodeExamples(exp.examples);
  const importStatement = buildImportStatement(exp, spec);

  const constValue =
    exp.schema && typeof exp.schema === 'object'
      ? (exp.schema as Record<string, unknown>).const
      : undefined;

  const displayExamples =
    examples.length > 0
      ? examples
      : [
          {
            id: 'default',
            label: 'TypeScript',
            code: `${importStatement}\n\nconsole.log(${exp.name}); // ${constValue !== undefined ? JSON.stringify(constValue) : typeValue}`,
            language: getLangForHighlight('typescript'),
          },
        ];

  return (
    <APISection
      id={exp.id || exp.name}
      title={`const ${exp.name}`}
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
      <ParameterList title="Type">
        <APIParameterItem
          name={exp.name}
          type={typeValue}
          description={
            constValue !== undefined ? `Value: ${JSON.stringify(constValue)}` : undefined
          }
        />
      </ParameterList>
    </APISection>
  );
}
