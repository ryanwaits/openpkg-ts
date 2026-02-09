'use client';

import type { CodeExample } from '@openpkg-ts/sdk/browser';
import { type ReactNode, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { CodeBlock } from './code-block';
import { CollapsiblePanel } from './collapsible-panel';
import { ExampleChips } from './example-chips';

export type { CodeExample };

export interface ExampleSectionProps {
  /** Section ID */
  id: string;
  /** Code examples to display */
  examples: CodeExample[];
  /** Optional title rendered as header above chips */
  title?: string;
  /** Data source code (SQL/schema) */
  dataSource?: string;
  /** Response JSON */
  response?: string;
  /** Notes text */
  notes?: ReactNode;
  /** Custom className */
  className?: string;
}

/**
 * Complete right-column section combining chips, code, and collapsible panels.
 */
export function ExampleSection({
  id,
  examples,
  title,
  dataSource,
  response,
  notes,
  className,
}: ExampleSectionProps): ReactNode {
  const [activeExampleId, setActiveExampleId] = useState(examples[0]?.id ?? '');
  const ref = useRef<HTMLDivElement>(null);

  const activeExample = examples.find((e) => e.id === activeExampleId) ?? examples[0];

  return (
    <div
      ref={ref}
      data-section={id}
      className={cn(
        'openpkg-example-section',
        'mb-12 last:mb-0',
        className,
      )}
    >
      {examples.length > 1 && (
        <ExampleChips
          examples={examples.map((e) => ({ id: e.id, label: e.label }))}
          activeId={activeExampleId}
          onSelect={setActiveExampleId}
        />
      )}

      {activeExample && (
        <CodeBlock
          code={activeExample.code}
          language={activeExample.language ?? 'typescript'}
          title={title}
          showLineNumbers
        />
      )}

      {dataSource && (
        <CollapsiblePanel title="Data source">
          <div className="p-4">
            <CodeBlock code={dataSource} language="sql" />
          </div>
        </CollapsiblePanel>
      )}

      {response && (
        <CollapsiblePanel title="Response">
          <div className="p-4">
            <CodeBlock code={response} language="json" />
          </div>
        </CollapsiblePanel>
      )}

      {notes && (
        <CollapsiblePanel title="Notes">
          <div
            className={cn(
              'openpkg-panel-note',
              'p-4',
              'text-[13px] text-[var(--openpkg-text-secondary)]',
              'leading-relaxed',
              '[&_code]:font-mono [&_code]:text-xs [&_code]:bg-[var(--openpkg-bg-badge)] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded',
            )}
          >
            {typeof notes === 'string' ? <p>{notes}</p> : notes}
          </div>
        </CollapsiblePanel>
      )}
    </div>
  );
}
