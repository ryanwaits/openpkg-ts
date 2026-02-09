'use client';

import type { CodeExample } from '@openpkg-ts/sdk/browser';
import { useEffect, useRef, useState } from 'react';
import type * as React from 'react';
import { cn } from '@/lib/utils';
import { ExampleSection } from './example-section';

export interface APISectionProps {
  /** Section title (e.g., "Create a customer", "The Customer object") */
  title: string;
  /** Optional anchor id for deep linking */
  id?: string;
  /** Optional description */
  description?: React.ReactNode;
  /** Left column content (parameters, returns, etc.) */
  children: React.ReactNode;
  /** Code examples for the right panel */
  examples: CodeExample[];
  /** Optional code panel title */
  codePanelTitle?: string;
  /** Custom className */
  className?: string;
}

/**
 * Single API section with two-column layout.
 * Docs/params on left, sticky code panel on right.
 * Dims entire section when not in the viewport's active zone.
 */
export function APISection({
  title,
  id,
  description,
  children,
  examples,
  codePanelTitle,
  className,
}: APISectionProps): React.ReactNode {
  const ref = useRef<HTMLElement>(null);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => setIsActive(entry.isIntersecting),
      { rootMargin: '-20% 0px -40% 0px', threshold: 0 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={ref}
      id={id}
      className={cn(
        'py-8 border-b border-border last:border-b-0',
        'transition-opacity duration-300',
        isActive ? 'opacity-100' : 'opacity-40',
        className,
      )}
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
        {/* Left column: Documentation */}
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold text-foreground">{title}</h2>
            {description && (
              <div className="mt-3 text-muted-foreground prose prose-sm dark:prose-invert">
                {description}
              </div>
            )}
          </div>
          {children}
        </div>

        {/* Right column: Code panel */}
        <div className="lg:pl-4">
          <div className="sticky top-20">
            <ExampleSection
              id={id ?? title}
              examples={examples}
              title={codePanelTitle}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
