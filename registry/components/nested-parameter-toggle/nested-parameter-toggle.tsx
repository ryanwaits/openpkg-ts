'use client';

import type { ReactNode } from 'react';

export interface NestedParameterToggleProps {
  expanded: boolean;
  onToggle: () => void;
  count?: number;
  className?: string;
}

/**
 * "Show/Hide child parameters" toggle button (Stripe-style).
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
      className={`openpkg-nested-toggle inline-flex items-center gap-2 font-sans text-[13px] font-medium text-[#a0a0a0] bg-transparent border border-[#333333] rounded-lg px-4 py-2.5 mt-3 cursor-pointer transition-all duration-150 hover:border-[#666666] hover:text-[#ededed] ${
        expanded ? 'rounded-b-none border-b-transparent mb-0' : ''
      } ${className || ''}`}
      aria-expanded={expanded}
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className={`transition-transform duration-200 ${expanded ? 'rotate-45' : ''}`}
      >
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
      <span>
        {expanded ? 'Hide' : 'Show'} child parameters
        {count !== undefined && ` (${count})`}
      </span>
    </button>
  );
}
