'use client';

import { cn } from '@openpkg-ts/ui/lib/utils';
import { ChevronDown } from 'lucide-react';
import { type ReactNode, useId, useState } from 'react';

export interface SectionAccordionProps {
  /** Section title (e.g., "PARAMETERS") */
  title: string;
  /** Section content */
  children: ReactNode;
  /** Default expanded state */
  defaultExpanded?: boolean;
  /** Custom className */
  className?: string;
}

/**
 * Collapsible section with header toggle.
 * MoneyKit-style accordion for single-theme API docs.
 */
export function SectionAccordion({
  title,
  children,
  defaultExpanded = true,
  className,
}: SectionAccordionProps): ReactNode {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const contentId = useId();

  return (
    <div className={cn('openpkg-section-accordion', className)}>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        aria-controls={contentId}
        className={cn(
          'flex items-center gap-2 w-full',
          'py-3',
          'cursor-pointer',
          'transition-colors duration-150',
          'hover:opacity-80',
        )}
      >
        <ChevronDown
          size={16}
          className={cn(
            'text-muted-foreground',
            'transition-transform duration-200',
            !expanded && '-rotate-90',
          )}
        />
        <span className="text-xs font-medium tracking-wider text-muted-foreground uppercase font-mono">
          {title}
        </span>
      </button>

      <div
        id={contentId}
        role="region"
        className={cn(
          'grid transition-[grid-template-rows,opacity] duration-200 ease-out',
          expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
        )}
      >
        <div className="min-h-0 overflow-hidden">{children}</div>
      </div>
    </div>
  );
}
