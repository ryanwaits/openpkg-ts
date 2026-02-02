'use client';

import type { OpenPkg, SpecExample, SpecExport } from '@openpkg-ts/spec';
import {
  APIParameterItem,
  APIReferencePage,
  APISection,
  ParameterList,
  type CodeExample,
  type Language,
} from '@openpkg-ts/ui/docskit';
import { cn } from '@openpkg-ts/ui/lib/utils';
import type { ReactNode } from 'react';
import { extractMethodData } from '@/registry/new-york/hooks/use-method-from-spec/use-method-from-spec';

export interface StripeAPIReferencePageProps {
  spec: OpenPkg;
  filter?: (exp: SpecExport) => boolean;
  showAllKinds?: boolean;
  className?: string;
}

/**
 * Full Stripe/Supabase-style API reference page.
 * Two-column layout with sticky code panel per section.
 */
export function StripeAPIReferencePage({
  spec,
  filter,
  showAllKinds = false,
  className,
}: StripeAPIReferencePageProps): ReactNode {
  const defaultFilter = (exp: SpecExport) => (showAllKinds ? true : exp.kind === 'function');
  const activeFilter = filter ?? defaultFilter;
  const exports = spec.exports.filter(activeFilter);
  const sortedExports = [...exports].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div
      className={cn(
        'openpkg-stripe-api-page',
        'bg-[var(--openpkg-bg-root)]',
        'text-[var(--openpkg-text-primary)]',
        'font-[var(--openpkg-font-sans)]',
        'min-h-screen',
        className,
      )}
    >
      <APIReferencePage title={spec.meta.name}>
        {sortedExports.map((exp) => {
          const method = extractMethodData(exp);
          const examples = getExamplesForExport(exp, spec);
          const languages = getLanguagesFromExamples(examples);

          return (
            <APISection
              key={exp.id || exp.name}
              id={exp.id || exp.name}
              title={method.title}
              description={method.description}
              languages={languages}
              examples={examples}
            >
              {method.parameters.length > 0 && (
                <ParameterList title="Parameters" collapseAfter={8}>
                  {method.parameters.map((param) => (
                    <APIParameterItem
                      key={param.name}
                      name={param.name}
                      type={param.schema?.typeString ?? param.schema?.type ?? 'unknown'}
                      required={!param.optional}
                      description={param.description}
                    />
                  ))}
                </ParameterList>
              )}
              {method.returnTypeString && (
                <ParameterList title="Returns">
                  <APIParameterItem
                    name="return"
                    type={method.returnTypeString}
                    description={method.returnDescription}
                  />
                </ParameterList>
              )}
            </APISection>
          );
        })}
      </APIReferencePage>
    </div>
  );
}

function specExampleToCodeExample(example: SpecExample | string, _index: number): CodeExample {
  if (typeof example === 'string') {
    return { languageId: 'typescript', code: example };
  }
  return {
    languageId: mapLanguage(example.language),
    code: example.code,
    highlightLang: mapLanguage(example.language),
  };
}

function specExamplesToCodeExamples(examples: (SpecExample | string)[]): CodeExample[] {
  return examples.map(specExampleToCodeExample);
}

function generateDefaultExample(packageName: string, exportName: string, paramNames: string[]): CodeExample {
  const importLine = `import { ${exportName} } from '${packageName}';`;
  const callArgs = paramNames.join(', ');
  const callLine = `const result = await ${exportName}(${callArgs});`;
  return { languageId: 'typescript', code: `${importLine}\n\n${callLine}` };
}

function mapLanguage(lang: string | undefined): string {
  switch (lang) {
    case 'ts': case 'tsx': return 'typescript';
    case 'js': case 'jsx': return 'javascript';
    case 'shell': return 'bash';
    default: return lang || 'typescript';
  }
}

function getExamplesForExport(exp: SpecExport, spec: OpenPkg): CodeExample[] {
  const method = extractMethodData(exp);
  if (method.examples.length > 0) return specExamplesToCodeExamples(method.examples);
  const paramNames = method.parameters.map((p) => p.name);
  return [generateDefaultExample(spec.meta.name, exp.name, paramNames)];
}

function getLanguagesFromExamples(examples: CodeExample[]): Language[] {
  const seen = new Set<string>();
  const languages: Language[] = [];
  for (const ex of examples) {
    if (!seen.has(ex.languageId)) {
      seen.add(ex.languageId);
      languages.push({ id: ex.languageId, label: ex.languageId });
    }
  }
  return languages;
}
