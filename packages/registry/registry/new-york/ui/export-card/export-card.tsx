'use client';

import { cn } from '@openpkg-ts/ui/lib/utils';
import type { ComponentType } from 'react';

export interface ExportCardProps {
  /** Function/export name */
  name: string;
  /** Description snippet */
  description?: string;
  /** Link to detail page */
  href: string;
  /** Export kind: function, type, variable, class, interface, enum */
  kind?: 'function' | 'type' | 'variable' | 'class' | 'interface' | 'enum';
  /** Custom className */
  className?: string;
  /** Custom link component (e.g. Next.js Link). Defaults to <a>. */
  linkComponent?: ComponentType<{ href: string; className?: string; children: React.ReactNode }>;
}

const KIND_COLORS: Record<ExportCardProps['kind'] & string, string> = {
  function: 'group-hover:text-[var(--openpkg-accent-blue)]',
  class: 'group-hover:text-[var(--openpkg-accent-purple)]',
  interface: 'group-hover:text-[var(--openpkg-accent-green)]',
  type: 'group-hover:text-[var(--openpkg-accent-amber)]',
  enum: 'group-hover:text-[var(--openpkg-accent-rose)]',
  variable: 'group-hover:text-[var(--openpkg-accent-cyan)]',
};

const KIND_BADGE_COLORS: Record<ExportCardProps['kind'] & string, string> = {
  function: 'bg-[color-mix(in_srgb,var(--openpkg-accent-blue)_10%,transparent)] text-[var(--openpkg-accent-blue)]',
  class: 'bg-[color-mix(in_srgb,var(--openpkg-accent-purple)_10%,transparent)] text-[var(--openpkg-accent-purple)]',
  interface: 'bg-[color-mix(in_srgb,var(--openpkg-accent-green)_10%,transparent)] text-[var(--openpkg-accent-green)]',
  type: 'bg-[color-mix(in_srgb,var(--openpkg-accent-amber)_10%,transparent)] text-[var(--openpkg-accent-amber)]',
  enum: 'bg-[color-mix(in_srgb,var(--openpkg-accent-rose)_10%,transparent)] text-[var(--openpkg-accent-rose)]',
  variable: 'bg-[color-mix(in_srgb,var(--openpkg-accent-cyan)_10%,transparent)] text-[var(--openpkg-accent-cyan)]',
};

/**
 * Card component for displaying exports in an index grid.
 * Features function name styling, description, and hover effects.
 */
export function ExportCard({
  name,
  description,
  href,
  kind = 'function',
  className,
  linkComponent: LinkComp = 'a' as any,
}: ExportCardProps): React.ReactNode {
  const isFunction = kind === 'function';
  const hoverColor = KIND_COLORS[kind];
  const badgeColor = KIND_BADGE_COLORS[kind];

  return (
    <LinkComp
      href={href}
      className={cn(
        'group block rounded-lg border border-[var(--openpkg-border-subtle)] bg-[var(--openpkg-bg-card)] p-4',
        'transition-all duration-200 ease-out',
        'hover:border-[var(--openpkg-accent-primary)] hover:bg-[var(--openpkg-bg-card-hover)] hover:shadow-lg',
        'hover:-translate-y-1',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--openpkg-accent-primary)]',
        className,
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        <span
          className={cn(
            'font-mono text-base font-medium text-[var(--openpkg-text-primary)] transition-colors duration-200',
            hoverColor,
          )}
        >
          {name}
        </span>
        {isFunction && <span className="font-mono text-base text-[var(--openpkg-text-muted)]">()</span>}
        <span className={cn('ml-auto text-xs px-2 py-0.5 rounded-full font-medium', badgeColor)}>
          {kind}
        </span>
      </div>
      {description && (
        <p className="text-sm text-[var(--openpkg-text-muted)] line-clamp-2 leading-relaxed transition-colors">
          {description}
        </p>
      )}
    </LinkComp>
  );
}
