'use client';

import {
  buildImportStatement,
  formatSchema,
  getLangForHighlight,
  resolveTypeRef,
  specExamplesToCodeExamples,
} from '@openpkg-ts/sdk/browser';
import type { OpenPkg, SpecExport, SpecSchema } from '@openpkg-ts/spec';
import { APIParameterItem, APISection, ExpandableParameter, ParameterList, ResponseBlock } from '@/registry/new-york/docskit/api';
import { type ReactNode, useCallback } from 'react';

export interface FunctionSectionProps {
  export: SpecExport;
  spec: OpenPkg;
}

export function FunctionSection({ export: exp, spec }: FunctionSectionProps): ReactNode {
  const sig = exp.signatures?.[0];
  const hasParams = sig?.parameters && sig.parameters.length > 0;

  const resolveRef = useCallback(
    (ref: string): SpecSchema | undefined => {
      const resolved = resolveTypeRef(ref, spec);
      return resolved?.schema as SpecSchema | undefined;
    },
    [spec],
  );

  const examples = specExamplesToCodeExamples(exp.examples);
  const importStatement = buildImportStatement(exp, spec);

  const displayExamples =
    examples.length > 0
      ? examples
      : [
          {
            id: 'default',
            label: 'TypeScript',
            code: `${importStatement}\n\n// Usage\n${exp.name}(${sig?.parameters?.map((p) => p.name).join(', ') || ''})`,
            language: getLangForHighlight('typescript'),
          },
        ];

  return (
    <APISection
      id={exp.id || exp.name}
      title={`${exp.name}()`}
      description={
        <div className="space-y-3">
          {exp.description && <p>{exp.description}</p>}
          <code className="text-sm font-mono bg-[var(--openpkg-bg-badge)] px-2 py-1 rounded inline-block">
            {importStatement}
          </code>
        </div>
      }
      examples={displayExamples}
      codePanelTitle={`${exp.name}()`}
    >
      {hasParams && (
        <ParameterList title="Parameters">
          {sig.parameters?.map((param, index) => (
            <ExpandableParameter key={param.name ?? index} parameter={param} resolveRef={resolveRef} />
          ))}
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
                <span className="ml-2 text-[var(--openpkg-text-muted)]">
                  {sig.returns.description}
                </span>
              )}
            </span>
          }
          className="mt-6"
        />
      )}

      {sig?.throws && sig.throws.length > 0 && (
        <div className="mt-6 rounded-md bg-[color-mix(in_srgb,var(--openpkg-accent-red)_10%,transparent)] border border-[color-mix(in_srgb,var(--openpkg-accent-red)_20%,transparent)] p-4">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--openpkg-accent-red)] mb-2">
            Throws
          </h4>
          <div className="space-y-1">
            {sig.throws.map((t, i) => (
              <div key={i} className="text-sm">
                {t.type && (
                  <code className="font-mono text-[var(--openpkg-accent-red)]">{t.type}</code>
                )}
                {t.type && t.description && <span className="mx-1">—</span>}
                {t.description && (
                  <span className="text-[var(--openpkg-text-muted)]">{t.description}</span>
                )}
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
