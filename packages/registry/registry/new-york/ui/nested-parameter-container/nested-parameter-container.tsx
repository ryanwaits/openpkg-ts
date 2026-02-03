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
        'border',
        level === 0
          ? 'border-[var(--openpkg-border-medium)]'
          : 'border-[var(--openpkg-border-subtle)]',
        'rounded-b-lg',
        'px-5',
        'mb-2',
        className,
      )}
      data-level={level}
    >
      {children}
    </div>
  );
}
