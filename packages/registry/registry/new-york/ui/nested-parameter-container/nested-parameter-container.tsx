'use client';

import { cn } from '@openpkg-ts/ui/lib/utils';
import type { ReactNode } from 'react';

export interface NestedParameterContainerProps {
  /** Nested parameter content */
  children: ReactNode;
  /** Nesting depth level (0 = first level) */
  level?: number;
  /** Custom className */
  className?: string;
}

/**
 * Bordered container for nested child parameters (Stripe-style).
 * Connects to NestedParameterToggle above (no top border).
 */
export function NestedParameterContainer({
  children,
  level = 0,
  className,
}: NestedParameterContainerProps): ReactNode {
  return (
    <div
      className={cn(
        'openpkg-nested-container',
        'border border-t-0',
        level === 0
          ? 'border-[var(--openpkg-border-medium,#333333)]'
          : 'border-[var(--openpkg-border-subtle,#262626)]',
        'rounded-b-lg',
        'px-5',
        'mb-2',
        '[&>.openpkg-param]:py-5',
        '[&>.openpkg-param]:border-b',
        '[&>.openpkg-param]:border-[var(--openpkg-border-subtle,#262626)]',
        '[&>.openpkg-param:last-child]:border-b-0',
        className,
      )}
      data-level={level}
    >
      {children}
    </div>
  );
}
