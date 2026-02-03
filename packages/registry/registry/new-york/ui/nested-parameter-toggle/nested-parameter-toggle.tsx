'use client';

import { cn } from '@openpkg-ts/ui/lib/utils';
import type { ReactNode } from 'react';

export interface NestedParameterToggleProps {
  /** Toggle state */
  expanded: boolean;
  /** Toggle callback */
  onToggle: () => void;
  /** Custom className */
  className?: string;
}

/**
 * "Show/Hide Child Attributes" toggle button.
 */
export function NestedParameterToggle({
  expanded,
  onToggle,
  className,
}: NestedParameterToggleProps): ReactNode {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'openpkg-nested-toggle',
        'inline-flex items-center gap-2',
        'font-sans text-[13px] font-medium',
        'text-[var(--openpkg-text-secondary)]',
        'bg-transparent',
        'border border-[var(--openpkg-border-medium)]',
        'rounded-lg',
        'px-4 py-2.5',
        'mt-3',
        'cursor-pointer',
        'transition-all duration-150',
        'hover:text-[var(--openpkg-text-primary)]',
        expanded && 'rounded-b-none border-b-transparent mb-0',
        className,
      )}
      aria-expanded={expanded}
    >
      <span className="text-[14px] leading-none">{expanded ? '×' : '+'}</span>
      <span>{expanded ? 'Hide' : 'Show'} Child Attributes</span>
    </button>
  );
}
