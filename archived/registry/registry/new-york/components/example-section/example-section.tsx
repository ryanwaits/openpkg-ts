'use client';

import { cn } from '@/lib/utils';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { CodeBlock } from '@/registry/new-york/ui/code-block/code-block';
import { CollapsiblePanel } from '@/registry/new-york/ui/collapsible-panel/collapsible-panel';
import { ExampleChips } from '@/registry/new-york/ui/example-chips/example-chips';

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
  /** Section ID used for intersection-based active tracking */
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
 * Uses IntersectionObserver on the parent section to dim when not in viewport.
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
  const [isActive, setIsActive] = useState(true);

  const activeExample = examples.find((e) => e.id === activeExampleId) ?? examples[0];

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const section = el.closest('section');
    const target = section ?? el;

    const observer = new IntersectionObserver(
      ([entry]) => setIsActive(entry.isIntersecting),
      { rootMargin: '-20% 0px -40% 0px', threshold: 0 },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, []);

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
