'use client';

import { cn } from '@openpkg-ts/ui/lib/utils';
import { Link } from 'lucide-react';
import type { ReactNode } from 'react';

export interface APIParameterItemProps {
  /** Parameter name */
  name: string;
  /** Parent path prefix (e.g., "options." for nested) */
  parentPath?: string;
  /** Parameter type */
  type: string;
  /** Required parameter */
  required?: boolean;
  /** Optional parameter (explicit) */
  optional?: boolean;
  /** Has expandable children */
  expandable?: boolean;
  /** Description */
  description?: ReactNode;
  /** Nested content (params or enum) */
  children?: ReactNode;
  /** Anchor ID for deep linking */
  anchorId?: string;
  /** Show anchor link on hover */
  showAnchor?: boolean;
  /** Custom className */
  className?: string;
}

/**
 * Single parameter row in Stripe-style documentation.
 * Displays name, type, badges, description, and optional nested content.
 *
 * @example
 * ```tsx
 * <APIParameterItem
 *   name="email"
 *   type="string"
 *   required
 *   description="User's email address"
 * />
 * ```
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
      className={cn(
        'openpkg-param',
        'py-5 border-b border-[var(--openpkg-border-subtle,#262626)]',
        'last:border-b-0',
        className,
      )}
    >
      {/* Header: anchor + name + badges + type */}
      <div className="openpkg-param-header flex items-center gap-2.5 mb-2 flex-wrap">
        {/* Anchor link (hover visible) */}
        {showAnchor && (
          <button
            type="button"
            onClick={handleAnchorClick}
            className={cn(
              'openpkg-anchor-link',
              'flex items-center justify-center w-4 h-4',
              'opacity-0 group-hover:opacity-100 hover:opacity-100',
              'text-[var(--openpkg-text-muted,#666666)]',
              'hover:text-[var(--openpkg-accent-blue,#6cb6ff)]',
              'cursor-pointer transition-opacity',
            )}
            aria-label="Copy link"
          >
            <Link size={14} />
          </button>
        )}

        {/* Name with parent path */}
        <span className="openpkg-param-name font-mono text-sm font-semibold">
          {parentPath && (
            <span className="text-[var(--openpkg-text-muted,#666666)]">{parentPath}</span>
          )}
          <span className="text-[var(--openpkg-text-primary,#ededed)]">{name}</span>
        </span>

        {/* Badges */}
        {required && (
          <span
            className={cn(
              'openpkg-param-badge',
              'text-[11px] font-medium uppercase tracking-wide',
              'px-2 py-0.5 rounded',
              'bg-[var(--openpkg-bg-badge,#262626)]',
              'text-[var(--openpkg-text-muted,#666666)]',
            )}
          >
            Required
          </span>
        )}
        {optional && (
          <span
            className={cn(
              'openpkg-param-badge',
              'text-[11px] font-medium uppercase tracking-wide',
              'px-2 py-0.5 rounded',
              'bg-[var(--openpkg-bg-badge,#262626)]',
              'text-[var(--openpkg-text-muted,#666666)]',
            )}
          >
            Optional
          </span>
        )}
        {expandable && (
          <span
            className={cn(
              'openpkg-badge-expandable',
              'text-[10px] font-medium',
              'px-2 py-0.5 rounded',
              'text-[var(--openpkg-accent-purple,#c4a7e7)]',
              'bg-[rgba(196,167,231,0.12)]',
            )}
          >
            Expandable
          </span>
        )}

        {/* Type */}
        <span className="openpkg-param-type text-[13px] text-[var(--openpkg-text-muted,#666666)]">
          {type}
        </span>
      </div>

      {/* Description */}
      {description && (
        <p
          className={cn(
            'openpkg-param-description',
            'text-sm text-[var(--openpkg-text-secondary,#a0a0a0)]',
            'leading-relaxed',
            '[&_code]:font-mono [&_code]:text-[13px] [&_code]:bg-[var(--openpkg-bg-badge,#262626)] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded',
          )}
        >
          {description}
        </p>
      )}

      {/* Nested content */}
      {children}
    </div>
  );
}
