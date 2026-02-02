'use client';

import { formatSchema } from '@openpkg-ts/sdk/browser';
import type { OpenPkg, SpecExport } from '@openpkg-ts/spec';
import { APIParameterItem, APISection, ParameterList } from '@openpkg-ts/ui/docskit';
import type { ReactNode } from 'react';
import {
  buildImportStatement,
  getLanguagesFromExamples,
  specExamplesToCodeExamples,
} from './spec-to-docskit';

export interface VariableSectionProps {
  export: SpecExport;
  spec: OpenPkg;
}

export function VariableSection({ export: exp, spec }: VariableSectionProps): ReactNode {
  const typeValue = typeof exp.type === 'string' ? exp.type : formatSchema(exp.schema);

  const languages = getLanguagesFromExamples(exp.examples);
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
            languageId: 'typescript',
            code: `${importStatement}\n\nconsole.log(${exp.name}); // ${constValue !== undefined ? JSON.stringify(constValue) : typeValue}`,
            highlightLang: 'ts',
          },
        ];

  const displayLanguages =
    languages.length > 0 ? languages : [{ id: 'typescript', label: 'TypeScript' }];

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
      languages={displayLanguages}
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
