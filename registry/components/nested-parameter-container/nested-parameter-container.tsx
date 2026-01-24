'use client';

import type { ReactNode } from 'react';

export interface NestedParameterContainerProps {
  children: ReactNode;
  level?: number;
  className?: string;
}

/**
 * Bordered container for nested child parameters (Stripe-style).
 */
export function NestedParameterContainer({
  children,
  level = 0,
  className,
}: NestedParameterContainerProps): ReactNode {
  const borderColor = level === 0 ? '#333333' : '#262626';

  return (
    <div
      className={`openpkg-nested-container border border-t-0 rounded-b-lg px-5 mb-2 ${className || ''}`}
      style={{ borderColor }}
      data-level={level}
    >
      {children}
    </div>
  );
}
