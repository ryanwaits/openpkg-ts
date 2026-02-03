'use client';

import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

export interface APIReferenceLayoutProps {
  /** Left column content (documentation) */
  children: ReactNode;
  /** Right column content (code examples) */
  examples: ReactNode;
  /** Custom className */
  className?: string;
  /** Left column width on desktop (default: 58%) */
  leftWidth?: string;
  /** Right column width on desktop (default: 42%) */
  rightWidth?: string;
}

/**
 * Two-column layout for API reference with sticky right panel.
 * Responsive: stacks vertically on mobile, two-column on desktop.
 */
export function APIReferenceLayout({
  children,
  examples,
  className,
  leftWidth = '58%',
  rightWidth = '42%',
}: APIReferenceLayoutProps): ReactNode {
  return (
    <div
      className={cn(
        'openpkg-api-layout',
        'max-w-[1600px] mx-auto',
        'flex flex-col',
        'lg:grid',
        className,
      )}
      style={
        {
          '--openpkg-left-width': leftWidth,
          '--openpkg-right-width': rightWidth,
        } as React.CSSProperties
      }
    >
      <div
        className={cn(
          'openpkg-api-layout-left',
          'py-8 px-4',
          'sm:py-10 sm:px-6',
          'lg:py-12 lg:px-12 lg:pl-16',
          'lg:border-r lg:border-[var(--openpkg-border-subtle)]',
          'bg-[var(--openpkg-bg-root)]',
          'openpkg-animate-fade-in',
        )}
        style={{ gridColumn: '1' }}
      >
        {children}
      </div>

      <div
        className={cn(
          'openpkg-api-layout-right',
          'border-t border-[var(--openpkg-border-subtle)] lg:border-t-0',
          'py-8 px-4',
          'sm:py-10 sm:px-6',
          'lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto',
          'lg:py-12 lg:px-12 lg:pl-8',
          'bg-[var(--openpkg-bg-root)]',
          'openpkg-animate-fade-in',
        )}
        style={{
          gridColumn: '2',
          animationDelay: '100ms',
        }}
      >
        {examples}
      </div>
    </div>
  );
}
