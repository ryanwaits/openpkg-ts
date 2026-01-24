'use client';

import { type ReactNode, useState } from 'react';

export interface CollapsiblePanelProps {
  title: string;
  children: ReactNode;
  defaultExpanded?: boolean;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  className?: string;
}

/**
 * Accordion-style collapsible panel for code examples.
 */
export function CollapsiblePanel({
  title,
  children,
  defaultExpanded = false,
  expanded: controlledExpanded,
  onExpandedChange,
  className,
}: CollapsiblePanelProps): ReactNode {
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);
  const isControlled = controlledExpanded !== undefined;
  const expanded = isControlled ? controlledExpanded : internalExpanded;

  const handleToggle = () => {
    const newValue = !expanded;
    if (isControlled) {
      onExpandedChange?.(newValue);
    } else {
      setInternalExpanded(newValue);
    }
  };

  return (
    <div className={`openpkg-collapsible-panel ${className || ''}`}>
      <button
        type="button"
        onClick={handleToggle}
        className={`openpkg-collapsible-trigger flex items-center gap-2.5 w-full px-4 py-3 bg-[#161616] border border-[#262626] cursor-pointer transition-all duration-150 hover:bg-[#1c1c1c] ${
          expanded ? 'rounded-t-md border-b-transparent mb-0' : 'rounded-md mb-2'
        }`}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`text-[#666666] transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <span className="text-[13px] font-medium text-[#a0a0a0]">{title}</span>
      </button>

      {expanded && (
        <div className="openpkg-collapsible-content bg-[#0f0f18] border border-[#262626] border-t-0 rounded-b-md mb-2 overflow-hidden">
          {children}
        </div>
      )}
    </div>
  );
}
