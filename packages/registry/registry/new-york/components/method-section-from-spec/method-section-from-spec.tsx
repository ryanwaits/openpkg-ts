'use client';

import type { OpenPkg, SpecExport } from '@openpkg-ts/spec';
import { cn } from '@openpkg-ts/ui/lib/utils';
import type { ReactNode } from 'react';
import { extractMethodData } from '@/registry/new-york/hooks/use-method-from-spec/use-method-from-spec';
import { ExpandableParameter } from '@/registry/new-york/components/expandable-parameter/expandable-parameter';
import { MethodSection } from '@/registry/new-york/components/method-section/method-section';

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
 */
export function MethodSectionFromSpec({
  spec,
  export: exportProp,
  className,
}: MethodSectionFromSpecProps): ReactNode {
  const exp =
    typeof exportProp === 'string' ? spec.exports.find((e) => e.name === exportProp) : exportProp;

  if (!exp) return null;

  const method = extractMethodData(exp);
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

function buildNotes(exp: SpecExport): string[] {
  const notes: string[] = [];

  if (exp.deprecated) {
    notes.push(
      exp.deprecationReason
        ? `⚠️ Deprecated: ${exp.deprecationReason}`
        : '⚠️ This function is deprecated.',
    );
  }

  const sig = exp.signatures?.[0];
  if (sig?.tags) {
    for (const tag of sig.tags) {
      if (tag.name === 'note' || tag.name === 'remarks') {
        notes.push(tag.text);
      }
    }
  }

  const flags = exp.flags as Record<string, unknown> | undefined;
  if (flags?.async) {
    notes.push('This function is async and returns a Promise.');
  }

  return notes;
}
