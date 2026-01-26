'use client';

import { cn } from '@openpkg-ts/ui/lib/utils';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { CodePanel } from './CodePanel';
import { CollapsiblePanel } from './CollapsiblePanel';
import { ExampleChips } from './ExampleChips';
import { useSyncScroll } from './SyncScrollProvider';

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
 *
 * @example
 * ```tsx
 * <ExampleSection
 *   id="select"
 *   examples={[
 *     { id: 'basic', label: 'Basic', code: '...', language: 'typescript' },
 *     { id: 'filter', label: 'With filter', code: '...', language: 'typescript' },
 *   ]}
 *   response={`{ "data": [...] }`}
 *   notes="Returns all columns by default."
 * />
 * ```
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

  // Get active example
  const activeExample = examples.find((e) => e.id === activeExampleId) ?? examples[0];

  // Check if this section is active
  const isActive = syncScroll?.activeSection === id;

  // Register with sync scroll if available
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
        // Dim inactive sections
        'transition-opacity duration-300',
        isActive ? 'opacity-100' : 'opacity-40',
        className,
      )}
    >
      {/* Example chips */}
      {examples.length > 1 && (
        <ExampleChips
          examples={examples.map((e) => ({ id: e.id, label: e.label }))}
          activeId={activeExampleId}
          onSelect={setActiveExampleId}
        />
      )}

      {/* Main code panel */}
      {activeExample && (
        <CodePanel
          code={activeExample.code}
          language={activeExample.language ?? 'typescript'}
          showLineNumbers
        />
      )}

      {/* Data source panel */}
      {dataSource && (
        <CollapsiblePanel title="Data source">
          <div className="p-4">
            <CodePanel code={dataSource} language="sql" />
          </div>
        </CollapsiblePanel>
      )}

      {/* Response panel */}
      {response && (
        <CollapsiblePanel title="Response">
          <div className="p-4">
            <CodePanel code={response} language="json" />
          </div>
        </CollapsiblePanel>
      )}

      {/* Notes panel */}
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

/**
 * Safe version of useSyncScroll that returns null if not in provider.
 */
function useSyncScrollSafe() {
  try {
    return useSyncScroll();
  } catch {
    return null;
  }
}
