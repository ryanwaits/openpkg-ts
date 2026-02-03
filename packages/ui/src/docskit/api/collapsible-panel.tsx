'use client';

import { cn } from '@/lib/utils';
import { ChevronRight } from 'lucide-react';
import { type ReactNode, useId, useState } from 'react';

export interface CollapsiblePanelProps {
  /** Panel title (e.g., "Response", "Data source") */
  title: string;
  /** Panel content */
  children: ReactNode;
  /** Default expanded state */
  defaultExpanded?: boolean;
  /** Controlled expanded state */
  expanded?: boolean;
  /** Controlled onChange */
  onExpandedChange?: (expanded: boolean) => void;
  /** Custom className */
  className?: string;
}

/**
 * Accordion-style collapsible panel for code examples.
 * Uses CSS grid-rows transition for smooth open/close.
 */
export function CollapsiblePanel({
  title,
  children,
  defaultExpanded = false,
  expanded: controlledExpanded,
  onExpandedChange,
  className,
}: CollapsiblePanelProps): ReactNode {
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);
  const isControlled = controlledExpanded !== undefined;
  const expanded = isControlled ? controlledExpanded : internalExpanded;
  const contentId = useId();

  const toggle = () => {
    const next = !expanded;
    if (isControlled) {
      onExpandedChange?.(next);
    } else {
      setInternalExpanded(next);
    }
  };

  return (
    <div className={cn('openpkg-collapsible-panel', className)}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={expanded}
        aria-controls={contentId}
        className={cn(
          'openpkg-collapsible-trigger',
          'flex items-center gap-2.5 w-full',
          'px-4 py-3',
          'bg-[var(--openpkg-bg-collapsible)]',
          'border border-[var(--openpkg-border-subtle)]',
          'rounded-md',
          'cursor-pointer',
          'transition-all duration-150',
          'hover:bg-[var(--openpkg-bg-tertiary)]',
          expanded && 'rounded-b-none border-b-transparent mb-0',
          !expanded && 'mb-2',
        )}
      >
        <ChevronRight
          size={14}
          className={cn(
            'text-[var(--openpkg-text-muted)]',
            'transition-transform duration-200',
            expanded && 'rotate-90',
          )}
        />
        <span className="text-[13px] font-medium text-[var(--openpkg-text-secondary)]">
          {title}
        </span>
      </button>

      <div
        id={contentId}
        role="region"
        className={cn(
          'openpkg-collapsible-content',
          'grid transition-[grid-template-rows,opacity] duration-200 ease-out',
          expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
        )}
      >
        <div
          className={cn(
            'min-h-0 overflow-hidden',
            'bg-[var(--openpkg-bg-code)]',
            'border border-[var(--openpkg-border-subtle)]',
            'border-t-0',
            'rounded-b-md',
            'mb-2',
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
