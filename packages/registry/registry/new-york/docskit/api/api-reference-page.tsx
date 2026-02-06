'use client';

import type * as React from 'react';
import { cn } from '@/lib/utils';

export interface APIReferencePageProps {
  /** Page title */
  title: string;
  /** Optional page description */
  description?: React.ReactNode;
  /** Theme variant */
  theme?: 'default' | 'single';
  /** API sections as children */
  children: React.ReactNode;
  /** Custom className */
  className?: string;
}

/**
 * Full page wrapper for API reference documentation.
 * Provides max-width container and consistent spacing.
 */
export function APIReferencePage({
  title,
  description,
  theme = 'default',
  children,
  className,
}: APIReferencePageProps): React.ReactNode {
  const containerClass = theme === 'single' ? 'max-w-[780px]' : 'max-w-7xl';

  return (
    <div className={cn(containerClass, 'mx-auto px-4 sm:px-6 lg:px-8', className)}>
      {/* Page header */}
      <header className="py-8 border-b border-border">
        <h1 className="text-3xl font-bold text-foreground">{title}</h1>
        {description && (
          <div className="mt-4 text-lg text-muted-foreground prose prose-lg dark:prose-invert max-w-none">
            {description}
          </div>
        )}
      </header>

      {/* Sections */}
      <div>{children}</div>
    </div>
  );
}
