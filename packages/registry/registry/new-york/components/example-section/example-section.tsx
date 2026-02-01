'use client';

import { cn } from '@openpkg-ts/ui/lib/utils';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { CodeBlock } from '@/registry/new-york/ui/code-block/code-block';
import { CollapsiblePanel } from '@/registry/new-york/ui/collapsible-panel/collapsible-panel';
import { ExampleChips } from '@/registry/new-york/ui/example-chips/example-chips';
import { useSyncScroll } from '@/registry/new-york/hooks/use-sync-scroll/use-sync-scroll';

export interface CodeExample {
  /** Unique identifier */
  id: string;
  /** Display label for chip */
  label: string;
  /** Code content */
  code: string;
  /** Language for highlighting */
  language?: string;
}

export interface ExampleSectionProps {
  /** Section ID for sync scroll */
  id: string;
  /** Code examples to display */
  examples: CodeExample[];
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
 * Integrates with SyncScrollProvider for synchronized scrolling.
 */
export function ExampleSection({
  id,
  examples,
  dataSource,
  response,
  notes,
  className,
}: ExampleSectionProps): ReactNode {
  const [activeExampleId, setActiveExampleId] = useState(examples[0]?.id ?? '');
  const ref = useRef<HTMLDivElement>(null);
  const syncScroll = useSyncScrollSafe();

  const activeExample = examples.find((e) => e.id === activeExampleId) ?? examples[0];
  const isActive = syncScroll?.activeSection === id;

  useEffect(() => {
    if (ref.current) {
      ref.current.setAttribute('data-section', id);
    }
  }, [id]);

  return (
    <div
      ref={ref}
      data-section={id}
      className={cn(
        'openpkg-example-section',
        'mb-12 last:mb-0',
        'transition-opacity duration-300',
        isActive ? 'opacity-100' : 'opacity-40',
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
              'text-[13px] text-[var(--openpkg-text-secondary,#a0a0a0)]',
              'leading-relaxed',
              '[&_code]:font-mono [&_code]:text-xs [&_code]:bg-[var(--openpkg-bg-badge,#262626)] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded',
            )}
          >
            {typeof notes === 'string' ? <p>{notes}</p> : notes}
          </div>
        </CollapsiblePanel>
      )}
    </div>
  );
}

function useSyncScrollSafe() {
  try {
    return useSyncScroll();
  } catch {
    return null;
  }
}
