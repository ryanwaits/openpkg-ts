'use client';

import type { OpenPkg, SpecExample, SpecExport } from '@openpkg-ts/spec';
import { cn } from '@openpkg-ts/ui/lib/utils';
import type { ReactNode } from 'react';
import { APIReferenceLayout } from '@/registry/new-york/components/api-reference-layout/api-reference-layout';
import { type CodeExample, ExampleSection } from '@/registry/new-york/components/example-section/example-section';
import { MethodSectionFromSpec } from '@/registry/new-york/components/method-section-from-spec/method-section-from-spec';
import { SyncScrollProvider } from '@/registry/new-york/hooks/use-sync-scroll/use-sync-scroll';
import { extractMethodData } from '@/registry/new-york/hooks/use-method-from-spec/use-method-from-spec';

export interface StripeAPIReferencePageProps {
  spec: OpenPkg;
  filter?: (exp: SpecExport) => boolean;
  showAllKinds?: boolean;
  className?: string;
}

/**
 * Full Stripe/Supabase-style API reference page.
 * Two-column layout with synchronized scrolling.
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
    <SyncScrollProvider>
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
        <APIReferenceLayout examples={<ExamplesColumn exports={sortedExports} spec={spec} />}>
          <DocsColumn exports={sortedExports} spec={spec} />
        </APIReferenceLayout>
      </div>
    </SyncScrollProvider>
  );
}

interface ColumnProps {
  exports: SpecExport[];
  spec: OpenPkg;
}

function DocsColumn({ exports, spec }: ColumnProps): ReactNode {
  return (
    <>
      {exports.map((exp) => (
        <MethodSectionFromSpec key={exp.id || exp.name} spec={spec} export={exp} />
      ))}
    </>
  );
}

function ExamplesColumn({ exports, spec }: ColumnProps): ReactNode {
  return (
    <>
      {exports.map((exp) => {
        const method = extractMethodData(exp);
        const examples = getExamplesForExport(exp, spec);

        return (
          <ExampleSection
            key={exp.id || exp.name}
            id={exp.id || exp.name}
            examples={examples}
            response={generateMockResponse(exp)}
            notes={method.returnDescription}
          />
        );
      })}
    </>
  );
}

function specExampleToCodeExample(example: SpecExample | string, index: number): CodeExample {
  if (typeof example === 'string') {
    return { id: `example-${index}`, label: `Example ${index + 1}`, code: example, language: 'typescript' };
  }
  return {
    id: example.title?.toLowerCase().replace(/\s+/g, '-') ?? `example-${index}`,
    label: example.title ?? `Example ${index + 1}`,
    code: example.code,
    language: mapLanguage(example.language),
  };
}

function specExamplesToCodeExamples(examples: (SpecExample | string)[]): CodeExample[] {
  return examples.map(specExampleToCodeExample);
}

function generateDefaultExample(packageName: string, exportName: string, paramNames: string[]): CodeExample {
  const importLine = `import { ${exportName} } from '${packageName}';`;
  const callArgs = paramNames.join(', ');
  const callLine = `const result = await ${exportName}(${callArgs});`;
  return { id: 'default', label: 'Basic', code: `${importLine}\n\n${callLine}`, language: 'typescript' };
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

function generateMockResponse(exp: SpecExport): string | undefined {
  const sig = exp.signatures?.[0];
  if (!sig?.returns?.schema) return undefined;

  const schema = sig.returns.schema;
  if (typeof schema !== 'object') return undefined;

  const s = schema as Record<string, unknown>;
  if (s.type === 'void' || s.type === 'undefined') return undefined;

  if (s.type === 'object' && s.properties) {
    const props = s.properties as Record<string, unknown>;
    const mock: Record<string, unknown> = {};
    for (const [key, propSchema] of Object.entries(props)) {
      mock[key] = getMockValue(propSchema as Record<string, unknown>);
    }
    return JSON.stringify(mock, null, 2);
  }

  if (s.type === 'array') {
    return JSON.stringify([getMockValue(s.items as Record<string, unknown>)], null, 2);
  }

  return undefined;
}

function getMockValue(schema: Record<string, unknown> | undefined): unknown {
  if (!schema) return null;
  switch (schema.type) {
    case 'string': return 'example';
    case 'number': case 'integer': return 42;
    case 'boolean': return true;
    case 'array': return [];
    case 'object': return {};
    default: return null;
  }
}
