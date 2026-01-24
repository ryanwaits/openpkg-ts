'use client';

import type { ReactNode } from 'react';

export type ExportKind = 'function' | 'type' | 'variable' | 'class' | 'interface' | 'enum';

export interface ExportCardProps {
  /** Function/export name */
  name: string;
  /** Description snippet */
  description?: string;
  /** Link to detail page */
  href: string;
  /** Export kind */
  kind?: ExportKind;
  /** Custom className */
  className?: string;
  /** Custom Link component (default: <a>) */
  LinkComponent?: React.ComponentType<{ href: string; className?: string; children: ReactNode }>;
}

/**
 * Headless export card component for index grids.
 * Style with CSS using data-kind attribute for kind-based colors.
 *
 * @example
 * ```tsx
 * <ExportCard
 *   name="createUser"
 *   description="Creates a new user"
 *   href="/api/functions/createUser"
 *   kind="function"
 * />
 * ```
 */
export function ExportCard({
  name,
  description,
  href,
  kind = 'function',
  className,
  LinkComponent,
}: ExportCardProps): ReactNode {
  const isFunction = kind === 'function';
  const Link = LinkComponent ?? 'a';

  return (
    <Link href={href} className={className} data-component="export-card" data-kind={kind}>
      <div data-slot="header">
        <span data-slot="name">
          {name}
          {isFunction && <span data-slot="parens">()</span>}
        </span>
        <span data-slot="badge" data-kind={kind}>
          {kind}
        </span>
      </div>
      {description && <p data-slot="description">{description}</p>}
    </Link>
  );
}
