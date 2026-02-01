'use client';

import { formatSchema } from '@openpkg-ts/sdk/browser';
import type { OpenPkg, SpecExport } from '@openpkg-ts/spec';
import { APIParameterItem, APISection, ParameterList, ResponseBlock } from '@openpkg-ts/ui/docskit';
import type { ReactNode } from 'react';
import {
  buildImportStatement,
  getLanguagesFromExamples,
  specExamplesToCodeExamples,
  specParamToAPIParam,
} from './spec-to-docskit';

export interface FunctionSectionProps {
  export: SpecExport;
  spec: OpenPkg;
}

export function FunctionSection({ export: exp, spec }: FunctionSectionProps): ReactNode {
  const sig = exp.signatures?.[0];
  const hasParams = sig?.parameters && sig.parameters.length > 0;

  const languages = getLanguagesFromExamples(exp.examples);
  const examples = specExamplesToCodeExamples(exp.examples);
  const importStatement = buildImportStatement(exp, spec);

  const displayExamples =
    examples.length > 0
      ? examples
      : [
          {
            languageId: 'typescript',
            code: `${importStatement}\n\n// Usage\n${exp.name}(${sig?.parameters?.map((p) => p.name).join(', ') || ''})`,
            highlightLang: 'ts',
          },
        ];

  const displayLanguages =
    languages.length > 0 ? languages : [{ id: 'typescript', label: 'TypeScript' }];

  return (
    <APISection
      id={exp.id || exp.name}
      title={`${exp.name}()`}
      description={
        <div className="space-y-3">
          {exp.description && <p>{exp.description}</p>}
          <code className="text-sm font-mono bg-muted px-2 py-1 rounded inline-block">
            {importStatement}
          </code>
        </div>
      }
      languages={displayLanguages}
      examples={displayExamples}
      codePanelTitle={`${exp.name}()`}
    >
      {hasParams && (
        <ParameterList title="Parameters">
          {sig.parameters?.map((param, index) => {
            const apiParam = specParamToAPIParam(param);
            return (
              <APIParameterItem
                key={param.name ?? index}
                name={apiParam.name}
                type={apiParam.type}
                required={apiParam.required}
                description={apiParam.description}
                children={apiParam.children}
              />
            );
          })}
        </ParameterList>
      )}

      {sig?.returns && (
        <ResponseBlock
          description={
            <span>
              <span className="font-mono text-sm font-medium">
                {formatSchema(sig.returns.schema)}
              </span>
              {sig.returns.description && (
                <span className="ml-2 text-muted-foreground">{sig.returns.description}</span>
              )}
            </span>
          }
          className="mt-6"
        />
      )}

      {sig?.throws && sig.throws.length > 0 && (
        <div className="mt-6 rounded-md bg-destructive/10 border border-destructive/20 p-4">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-destructive mb-2">
            Throws
          </h4>
          <div className="space-y-1">
            {sig.throws.map((t, i) => (
              <div key={i} className="text-sm">
                {t.type && <code className="font-mono text-destructive">{t.type}</code>}
                {t.type && t.description && <span className="mx-1">—</span>}
                {t.description && <span className="text-muted-foreground">{t.description}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {exp.typeParameters && exp.typeParameters.length > 0 && (
        <ParameterList title="Type Parameters" className="mt-6">
          {exp.typeParameters.map((tp) => (
            <APIParameterItem
              key={tp.name}
              name={tp.name}
              type={tp.constraint || 'unknown'}
              description={tp.default ? `Default: ${tp.default}` : undefined}
            />
          ))}
        </ParameterList>
      )}
    </APISection>
  );
}
