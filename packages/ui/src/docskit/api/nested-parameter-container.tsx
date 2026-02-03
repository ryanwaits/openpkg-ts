'use client';

import { cn } from '@/lib/utils';
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
 * Bordered container for nested child parameters (Scalar/Clerk-style).
 * Connects to NestedParameterToggle above — shares the same border,
 * so this has no top border and only bottom-rounded corners.
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
        'border border-t-0 border-[var(--openpkg-border-medium)]',
        'rounded-b-lg',
        'px-5',
        '[&>.openpkg-expandable-param]:py-4',
        '[&>.openpkg-expandable-param]:border-b',
        '[&>.openpkg-expandable-param]:border-[var(--openpkg-border-subtle)]',
        '[&>.openpkg-expandable-param:last-child]:border-b-0',
        '[&>.openpkg-expandable-param:last-child]:pb-4',
        '[&>.openpkg-expandable-param_.openpkg-param]:py-0',
        '[&>.openpkg-expandable-param_.openpkg-param]:border-b-0',
        className,
      )}
      data-level={level}
    >
      {children}
    </div>
  );
}
