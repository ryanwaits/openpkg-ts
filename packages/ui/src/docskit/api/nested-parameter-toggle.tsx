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
 * "Show/Hide Child Attributes" toggle button (Stripe-style).
 * When collapsed: inline-block rounded pill button.
 * When expanded: full-width top of unified bordered container.
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
        'flex items-center gap-2',
        'font-sans text-[13px] font-medium',
        'text-[var(--openpkg-text-secondary)]',
        'bg-transparent',
        'border border-[var(--openpkg-border-medium)]',
        'px-2 py-1.5',
        'cursor-pointer',
        'transition-[width,border-radius,border-color,color] duration-200 ease-out',
        'hover:text-[var(--openpkg-text-primary)]',
        expanded
          ? 'w-full rounded-t-md rounded-b-none border-b-[var(--openpkg-border-subtle)]'
          : 'w-fit rounded-md',
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
