'use client';

import { cn } from '@openpkg-ts/ui/lib/utils';
import { Plus } from 'lucide-react';
import type { ReactNode } from 'react';

export interface NestedParameterToggleProps {
  /** Toggle state */
  expanded: boolean;
  /** Toggle callback */
  onToggle: () => void;
  /** Optional child count to display */
  count?: number;
  /** Custom className */
  className?: string;
}

/**
 * "Show/Hide child parameters" toggle button (Stripe-style).
 * Plus icon rotates 45deg when expanded.
 * When expanded, bottom border-radius removed to connect with container.
 *
 * @example
 * ```tsx
 * <NestedParameterToggle
 *   expanded={isOpen}
 *   onToggle={() => setIsOpen(!isOpen)}
 *   count={3}
 * />
 * ```
 */
export function NestedParameterToggle({
  expanded,
  onToggle,
  count,
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
        'text-[var(--openpkg-text-secondary,#a0a0a0)]',
        'bg-transparent',
        'border border-[var(--openpkg-border-medium,#333333)]',
        'rounded-lg',
        'px-4 py-2.5',
        'mt-3',
        'cursor-pointer',
        'transition-all duration-150',
        'hover:border-[var(--openpkg-text-muted,#666666)]',
        'hover:text-[var(--openpkg-text-primary,#ededed)]',
        // When expanded: remove bottom radius, hide bottom border
        expanded && 'rounded-b-none border-b-transparent mb-0',
        className,
      )}
      aria-expanded={expanded}
    >
      <Plus
        size={12}
        className={cn('transition-transform duration-200', expanded && 'rotate-45')}
      />
      <span>
        {expanded ? 'Hide' : 'Show'} child parameters
        {count !== undefined && ` (${count})`}
      </span>
    </button>
  );
}
