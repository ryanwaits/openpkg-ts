'use client';

import type { OpenPkg, SpecExport } from '@openpkg-ts/spec';
import { cn } from '@openpkg-ts/ui/lib/utils';
import type { ReactNode } from 'react';
import { specParamToNestedParam } from '../../adapters/spec-to-params';
import { extractMethodData } from '../../hooks/useMethodFromSpec';
import { ExpandableParameter } from './ExpandableParameter';
import { MethodSection } from './MethodSection';

export interface MethodSectionFromSpecProps {
  /** OpenPkg spec */
  spec: OpenPkg;
  /** Export to render (by name or object) */
  export: string | SpecExport;
  /** Custom className */
  className?: string;
}

/**
 * Auto-generates MethodSection from spec data.
 * Extracts parameters, description, and notes from the export.
 *
 * @example
 * ```tsx
 * <MethodSectionFromSpec spec={spec} export="createClient" />
 * ```
 */
export function MethodSectionFromSpec({
  spec,
  export: exportProp,
  className,
}: MethodSectionFromSpecProps): ReactNode {
  // Resolve export
  const exp =
    typeof exportProp === 'string' ? spec.exports.find((e) => e.name === exportProp) : exportProp;

  if (!exp) {
    return null;
  }

  // Extract method data
  const method = extractMethodData(exp, spec);

  // Build notes from tags
  const notes = buildNotes(exp);

  return (
    <MethodSection
      id={exp.id || exp.name}
      title={method.title}
      signature={method.signature}
      description={method.description}
      notes={notes}
      className={cn('openpkg-method-from-spec', className)}
    >
      {method.parameters.map((param) => (
        <ExpandableParameter key={param.name} parameter={param} />
      ))}
    </MethodSection>
  );
}

/**
 * Extract notes from export tags.
 */
function buildNotes(exp: SpecExport): string[] {
  const notes: string[] = [];

  // Add deprecation note
  if (exp.deprecated) {
    notes.push(
      exp.deprecationReason
        ? `⚠️ Deprecated: ${exp.deprecationReason}`
        : '⚠️ This function is deprecated.',
    );
  }

  // Add notes from tags
  const sig = exp.signatures?.[0];
  if (sig?.tags) {
    for (const tag of sig.tags) {
      if (tag.name === 'note' || tag.name === 'remarks') {
        notes.push(tag.text);
      }
    }
  }

  // Add async note
  const flags = exp.flags as Record<string, unknown> | undefined;
  if (flags?.async) {
    notes.push('This function is async and returns a Promise.');
  }

  return notes;
}
