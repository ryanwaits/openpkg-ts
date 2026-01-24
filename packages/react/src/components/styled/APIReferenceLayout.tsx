'use client';

import { cn } from '@openpkg-ts/ui/lib/utils';
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
 *
 * @example
 * ```tsx
 * <APIReferenceLayout
 *   examples={<CodeExamples />}
 * >
 *   <MethodSection ... />
 * </APIReferenceLayout>
 * ```
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
        // Mobile: single column
        'flex flex-col',
        // Desktop: two-column grid
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
      {/* Left column - scrollable documentation */}
      <div
        className={cn(
          'openpkg-api-layout-left',
          // Mobile padding
          'py-8 px-4',
          // Tablet padding
          'sm:py-10 sm:px-6',
          // Desktop padding
          'lg:py-12 lg:px-12 lg:pl-16',
          // Border only on desktop
          'lg:border-r lg:border-[var(--openpkg-border-subtle,#262626)]',
          // Fade-in animation
          'openpkg-animate-fade-in',
        )}
        style={{
          // Use CSS custom property for grid on desktop
          gridColumn: '1',
        }}
      >
        {children}
      </div>

      {/* Right column - code examples */}
      <div
        className={cn(
          'openpkg-api-layout-right',
          // Mobile: normal flow with top border
          'border-t border-[var(--openpkg-border-subtle,#262626)] lg:border-t-0',
          'py-8 px-4',
          // Tablet padding
          'sm:py-10 sm:px-6',
          // Desktop: sticky, no border
          'lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto',
          'lg:py-12 lg:px-12 lg:pl-8',
          // Background
          'bg-[var(--openpkg-bg-root,#0c0c0c)]',
          // Fade-in animation
          'openpkg-animate-fade-in',
        )}
        style={{
          gridColumn: '2',
          // Animation delay for staggered effect
          animationDelay: '100ms',
        }}
      >
        {examples}
      </div>

      {/* Inject responsive grid styles */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media (min-width: 1024px) {
              .openpkg-api-layout {
                grid-template-columns: var(--openpkg-left-width, 58%) var(--openpkg-right-width, 42%);
                align-items: start;
              }
            }
          `,
        }}
      />
    </div>
  );
}
