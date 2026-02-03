'use client';

import { cn } from '@/lib/utils';
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
 * "Show/Hide Child Attributes" toggle button (Scalar/Clerk-style).
 * When collapsed: standalone rounded pill.
 * When expanded: top of a unified bordered container (rounded-t, no bottom border).
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
        'flex items-center gap-2 w-full',
        'font-sans text-[13px] font-medium',
        'text-[var(--openpkg-text-secondary)]',
        'bg-transparent',
        'border border-[var(--openpkg-border-medium)]',
        'px-4 py-3',
        'cursor-pointer',
        'transition-all duration-150',
        'hover:text-[var(--openpkg-text-primary)]',
        expanded
          ? 'rounded-t-lg rounded-b-none border-b-[var(--openpkg-border-subtle)]'
          : 'rounded-lg',
        className,
      )}
      aria-expanded={expanded}
    >
      <span className="text-[13px]">{expanded ? '×' : '+'}</span>
      <span>
        {expanded ? 'Hide' : 'Show'} Child Attributes
      </span>
    </button>
  );
}
