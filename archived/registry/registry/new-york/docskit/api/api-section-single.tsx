'use client';

import type { SpecSchema } from '@openpkg-ts/spec';
import type * as React from 'react';
import { cn } from '@/lib/utils';
import { ClientDocsKitCode } from '../code.client-highlight';
import { PackageInstall } from '../code.package-install';
import { SectionAccordion } from './section-accordion';

export interface APISectionSingleProps {
  /** Section title (e.g., "createCustomer") */
  title: string;
  /** Optional anchor id for deep linking */
  id?: string;
  /** Optional description */
  description?: React.ReactNode;
  /** Code example */
  example: { code: string; lang?: string };
  /** Optional title shown in code block header */
  codePanelTitle?: string;
  /** Package name for install command (omit to hide install block) */
  packageName?: string;
  /** Parameters content (ExpandableParameter children) */
  parameters?: React.ReactNode;
  /** Return type info */
  returns?: { type: string; description?: React.ReactNode };
  /** Callback to resolve $ref schemas */
  resolveRef?: (ref: string) => SpecSchema | undefined;
  /** Custom className */
  className?: string;
}

/**
 * Single-column API section for MoneyKit-style docs.
 * Vertical layout with code example, install command, parameters accordion, returns.
 */
export function APISectionSingle({
  title,
  id,
  description,
  example,
  codePanelTitle,
  packageName,
  parameters,
  returns,
  className,
}: APISectionSingleProps): React.ReactNode {
  return (
    <section id={id} className={cn('max-w-[780px] mx-auto py-12 px-6', className)}>
      {/* Header */}
      <header>
        <h1 className="font-mono text-2xl font-semibold text-foreground">{title}</h1>
        {description && (
          <div className="mt-3 text-muted-foreground prose prose-sm dark:prose-invert">
            {description}
          </div>
        )}
      </header>

      {/* Code example */}
      <div className="mt-8">
        <ClientDocsKitCode
          codeblock={{ value: example.code, lang: example.lang || 'typescript', meta: codePanelTitle ? `${codePanelTitle} -c` : '-c' }}
        />
      </div>

      {/* Package install */}
      {packageName && (
        <>
          <hr className="border-border my-8" />
          <PackageInstall package={packageName} />
        </>
      )}

      {/* Parameters */}
      {parameters && (
        <>
          <hr className="border-border my-8" />
          <SectionAccordion title="Parameters" defaultExpanded>
            <div className="space-y-4 pt-2">{parameters}</div>
          </SectionAccordion>
        </>
      )}

      {/* Returns */}
      {returns && (
        <>
          <hr className="border-border my-8" />
          <div className="returns-section">
            <h3 className="text-xs font-medium tracking-wider text-muted-foreground uppercase font-mono mb-4">
              Returns
            </h3>
            <code className="text-sm font-mono text-foreground bg-muted px-2 py-1 rounded">
              {returns.type}
            </code>
            {returns.description && (
              <div className="mt-2 text-sm text-muted-foreground">{returns.description}</div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
