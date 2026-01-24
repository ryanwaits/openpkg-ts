'use client';

import type { ReactNode } from 'react';

export interface APIParameterItemProps {
  name: string;
  parentPath?: string;
  type: string;
  required?: boolean;
  optional?: boolean;
  expandable?: boolean;
  description?: ReactNode;
  children?: ReactNode;
  anchorId?: string;
  showAnchor?: boolean;
  className?: string;
}

/**
 * Single parameter row in Stripe-style documentation.
 */
export function APIParameterItem({
  name,
  parentPath,
  type,
  required,
  optional,
  expandable,
  description,
  children,
  anchorId,
  showAnchor = false,
  className,
}: APIParameterItemProps): ReactNode {
  const handleAnchorClick = () => {
    if (anchorId && typeof window !== 'undefined') {
      window.location.hash = anchorId;
      navigator.clipboard?.writeText(window.location.href);
    }
  };

  return (
    <div
      id={anchorId}
      className={`openpkg-param py-5 border-b border-[#262626] last:border-b-0 ${className || ''}`}
    >
      <div className="openpkg-param-header flex items-center gap-2.5 mb-2 flex-wrap">
        {showAnchor && (
          <button
            type="button"
            onClick={handleAnchorClick}
            className="openpkg-anchor-link flex items-center justify-center w-4 h-4 opacity-0 group-hover:opacity-100 hover:opacity-100 text-[#666666] hover:text-[#6cb6ff] cursor-pointer transition-opacity"
            aria-label="Copy link"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
          </button>
        )}

        <span className="openpkg-param-name font-mono text-sm font-semibold">
          {parentPath && <span className="text-[#666666]">{parentPath}</span>}
          <span className="text-[#ededed]">{name}</span>
        </span>

        {required && (
          <span className="openpkg-param-badge text-[11px] font-medium uppercase tracking-wide px-2 py-0.5 rounded bg-[#262626] text-[#666666]">
            Required
          </span>
        )}
        {optional && (
          <span className="openpkg-param-badge text-[11px] font-medium uppercase tracking-wide px-2 py-0.5 rounded bg-[#262626] text-[#666666]">
            Optional
          </span>
        )}
        {expandable && (
          <span className="openpkg-badge-expandable text-[10px] font-medium px-2 py-0.5 rounded text-[#c4a7e7] bg-[rgba(196,167,231,0.12)]">
            Expandable
          </span>
        )}

        <span className="openpkg-param-type text-[13px] text-[#666666]">{type}</span>
      </div>

      {description && (
        <p className="openpkg-param-description text-sm text-[#a0a0a0] leading-relaxed">
          {description}
        </p>
      )}

      {children}
    </div>
  );
}
