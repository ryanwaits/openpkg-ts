'use client';

import type { OpenPkg, SpecExport } from '@openpkg-ts/spec';
import { cn } from '@openpkg-ts/ui/lib/utils';
import type { ReactNode } from 'react';
import {
  generateDefaultExample,
  specExamplesToCodeExamples,
} from '../../adapters/spec-to-examples';
import { extractMethodData } from '../../hooks/useMethodFromSpec';
import { APIReferenceLayout } from './APIReferenceLayout';
import { type CodeExample, ExampleSection } from './ExampleSection';
import { MethodSectionFromSpec } from './MethodSectionFromSpec';
import { SyncScrollProvider } from './SyncScrollProvider';

export interface StripeAPIReferencePageProps {
  /** OpenPkg spec */
  spec: OpenPkg;
  /** Filter exports (default: functions only) */
  filter?: (exp: SpecExport) => boolean;
  /** Show all export kinds, not just functions */
  showAllKinds?: boolean;
  /** Custom className */
  className?: string;
}

/**
 * Full Stripe/Supabase-style API reference page.
 * Two-column layout with synchronized scrolling.
 *
 * @example
 * ```tsx
 * <StripeAPIReferencePage spec={spec} />
 * ```
 */
export function StripeAPIReferencePage({
  spec,
  filter,
  showAllKinds = false,
  className,
}: StripeAPIReferencePageProps): ReactNode {
  // Filter exports
  const defaultFilter = (exp: SpecExport) => (showAllKinds ? true : exp.kind === 'function');
  const activeFilter = filter ?? defaultFilter;
  const exports = spec.exports.filter(activeFilter);

  // Sort by name
  const sortedExports = [...exports].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <SyncScrollProvider>
      <div
        className={cn(
          'openpkg-stripe-api-page',
          'bg-[var(--openpkg-bg-root,#0c0c0c)]',
          'text-[var(--openpkg-text-primary,#ededed)]',
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

// =============================================================================
// Internal Components
// =============================================================================

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
        const method = extractMethodData(exp, spec);
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

/**
 * Get code examples for an export.
 */
function getExamplesForExport(exp: SpecExport, spec: OpenPkg): CodeExample[] {
  const method = extractMethodData(exp, spec);

  // Use provided examples if available
  if (method.examples.length > 0) {
    return specExamplesToCodeExamples(method.examples);
  }

  // Generate default example
  const paramNames = method.parameters.map((p) => p.name);
  return [generateDefaultExample(spec.meta.name, exp.name, paramNames)];
}

/**
 * Generate a mock response for display.
 */
function generateMockResponse(exp: SpecExport): string | undefined {
  const sig = exp.signatures?.[0];
  if (!sig?.returns?.schema) return undefined;

  // Simple mock based on return type
  const schema = sig.returns.schema;
  if (typeof schema === 'object') {
    const s = schema as Record<string, unknown>;

    if (s.type === 'void' || s.type === 'undefined') {
      return undefined;
    }

    if (s.type === 'object' && s.properties) {
      // Generate mock object
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
  }

  return undefined;
}

function getMockValue(schema: Record<string, unknown> | undefined): unknown {
  if (!schema) return null;

  switch (schema.type) {
    case 'string':
      return 'example';
    case 'number':
    case 'integer':
      return 42;
    case 'boolean':
      return true;
    case 'array':
      return [];
    case 'object':
      return {};
    default:
      return null;
  }
}
