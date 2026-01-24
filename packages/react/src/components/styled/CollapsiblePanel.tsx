'use client';

import * as Collapsible from '@radix-ui/react-collapsible';
import { cn } from '@openpkg-ts/ui/lib/utils';
import { ChevronRight } from 'lucide-react';
import { type ReactNode, useState } from 'react';

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
 * Used for Response, Data source, and Notes sections.
 *
 * @example
 * ```tsx
 * <CollapsiblePanel title="Response">
 *   <CodePanel code={responseJson} language="json" />
 * </CollapsiblePanel>
 * ```
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

  const handleOpenChange = (open: boolean) => {
    if (isControlled) {
      onExpandedChange?.(open);
    } else {
      setInternalExpanded(open);
    }
  };

  return (
    <Collapsible.Root
      open={expanded}
      onOpenChange={handleOpenChange}
      className={cn('openpkg-collapsible-panel', className)}
    >
      {/* Trigger */}
      <Collapsible.Trigger
        className={cn(
          'openpkg-collapsible-trigger',
          'flex items-center gap-2.5 w-full',
          'px-4 py-3',
          'bg-[var(--openpkg-bg-collapsible,#161616)]',
          'border border-[var(--openpkg-border-subtle,#262626)]',
          'rounded-md',
          'cursor-pointer',
          'transition-all duration-150',
          'hover:bg-[var(--openpkg-bg-tertiary,#1c1c1c)]',
          // When expanded, connect to content below
          expanded && 'rounded-b-none border-b-transparent mb-0',
          !expanded && 'mb-2',
        )}
      >
        <ChevronRight
          size={14}
          className={cn(
            'text-[var(--openpkg-text-muted,#666666)]',
            'transition-transform duration-200',
            expanded && 'rotate-90',
          )}
        />
        <span className="text-[13px] font-medium text-[var(--openpkg-text-secondary,#a0a0a0)]">
          {title}
        </span>
      </Collapsible.Trigger>

      {/* Content */}
      <Collapsible.Content
        className={cn(
          'openpkg-collapsible-content',
          'bg-[var(--openpkg-bg-code,#0f0f18)]',
          'border border-[var(--openpkg-border-subtle,#262626)]',
          'border-t-0',
          'rounded-b-md',
          'mb-2',
          'overflow-hidden',
          // Radix animations via CSS
          'data-[state=open]:animate-[openpkg-expand_200ms_ease-out]',
          'data-[state=closed]:animate-[openpkg-collapse_200ms_ease-out]',
        )}
      >
        {children}
      </Collapsible.Content>
    </Collapsible.Root>
  );
}
