'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface APIParameterSchema {
  /** Type name */
  type?: string;
  /** Formatted type string */
  typeString?: string;
  /** Description */
  description?: string;
  /** Nested properties for object types */
  properties?: Record<string, APIParameterSchema>;
  /** Required property names */
  required?: string[];
}

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
 * Single parameter row (Scalar/Clerk-style).
 * Displays name, type, required badge (orange text), description, and optional nested content.
 */
export function APIParameterItem({
  name,
  parentPath,
  type,
  required,
  optional,
  description,
  children,
  anchorId,
  className,
}: APIParameterItemProps): ReactNode {
  return (
    <div
      id={anchorId}
      className={cn(
        'openpkg-param',
        'py-5 border-b border-[var(--openpkg-border-subtle)]',
        'last:border-b-0',
        className,
      )}
    >
      {/* Header: name + type + required */}
      <div className="openpkg-param-header flex items-baseline gap-2 mb-1 flex-wrap">
        {/* Name with parent path */}
        <span className="openpkg-param-name font-mono text-sm font-semibold">
          {parentPath && <span className="text-[var(--openpkg-text-muted)]">{parentPath}</span>}
          <span className="text-[var(--openpkg-text-primary)]">{name}</span>
        </span>

        {/* Type */}
        <span className="openpkg-param-type text-[13px] text-[var(--openpkg-text-muted)]">
          {type}
        </span>

        {/* Required badge — orange text like Clerk/Scalar */}
        {required && (
          <span className="openpkg-param-badge text-[13px] font-medium text-[var(--openpkg-accent-orange,#d4a553)]">
            required
          </span>
        )}
        {optional && (
          <span className="openpkg-param-badge text-[13px] text-[var(--openpkg-text-muted)]">
            optional
          </span>
        )}
      </div>

      {/* Description */}
      {description && (
        <p
          className={cn(
            'openpkg-param-description',
            'text-sm text-[var(--openpkg-text-secondary)]',
            'leading-relaxed',
            '[&_code]:font-mono [&_code]:text-[13px] [&_code]:bg-[var(--openpkg-bg-badge)] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded',
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
