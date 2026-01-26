'use client';

import { cn } from '@openpkg-ts/ui/lib/utils';
import { type ReactNode, useEffect, useRef } from 'react';
import { useSyncScroll } from './SyncScrollProvider';

export interface MethodSectionProps {
  /** Section ID for scroll sync */
  id: string;
  /** Method title (e.g., "Fetch data") */
  title: string;
  /** Method signature (e.g., "select(columns?, options?)") */
  signature?: string;
  /** Method description */
  description?: ReactNode;
  /** Bullet list notes */
  notes?: string[];
  /** Parameter content */
  children?: ReactNode;
  /** Custom className */
  className?: string;
}

/**
 * Container for a single API method in the documentation.
 * Renders title, signature, description, notes list, and parameters.
 *
 * @example
 * ```tsx
 * <MethodSection
 *   id="select"
 *   title="Fetch data"
 *   signature="select(columns?, options?)"
 *   description="Performs a SELECT query..."
 *   notes={['By default, returns all columns', 'Use .single() for one row']}
 * >
 *   <ParameterItem ... />
 * </MethodSection>
 * ```
 */
export function MethodSection({
  id,
  title,
  signature,
  description,
  notes,
  children,
  className,
}: MethodSectionProps): ReactNode {
  const ref = useRef<HTMLElement>(null);
  const syncScroll = useSyncScrollSafe();

  // Register with sync scroll provider if available
  useEffect(() => {
    if (syncScroll && ref.current) {
      syncScroll.registerSection(id, ref);
      return () => syncScroll.unregisterSection(id);
    }
  }, [id, syncScroll]);

  return (
    <section
      ref={ref}
      id={id}
      data-section={id}
      className={cn('openpkg-method-section', 'mb-20 last:mb-0', className)}
    >
      {/* Title */}
      <h2
        className={cn(
          'text-2xl font-semibold tracking-tight',
          'text-[var(--openpkg-text-primary,#ededed)]',
          'mb-4',
        )}
      >
        {title}
      </h2>

      {/* Signature */}
      {signature && (
        <code
          className={cn(
            'block font-mono text-sm',
            'text-[var(--openpkg-text-muted,#666666)]',
            'mb-6',
          )}
        >
          {signature}
        </code>
      )}

      {/* Description */}
      {description && (
        <div
          className={cn(
            'openpkg-method-description',
            'text-[15px] leading-relaxed',
            'text-[var(--openpkg-text-secondary,#a0a0a0)]',
            'mb-6',
            '[&_a]:text-[var(--openpkg-accent-link,#6cb6ff)] [&_a]:no-underline [&_a]:font-medium hover:[&_a]:underline',
            '[&_code]:bg-[var(--openpkg-bg-badge,#262626)] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:font-mono [&_code]:text-[13px]',
          )}
        >
          {typeof description === 'string' ? <p>{description}</p> : description}
        </div>
      )}

      {/* Notes list */}
      {notes && notes.length > 0 && (
        <ul
          className={cn(
            'openpkg-method-notes',
            'list-disc list-inside',
            'text-[15px] leading-relaxed',
            'text-[var(--openpkg-text-secondary,#a0a0a0)]',
            'mb-8 space-y-2',
          )}
        >
          {notes.map((note, i) => (
            <li key={i}>{note}</li>
          ))}
        </ul>
      )}

      {/* Parameters section header */}
      {children && (
        <div className="openpkg-method-params">
          <h3
            className={cn(
              'text-xs font-semibold uppercase tracking-wider',
              'text-[var(--openpkg-text-muted,#666666)]',
              'mb-4 pb-2',
              'border-b border-[var(--openpkg-border-subtle,#262626)]',
            )}
          >
            Parameters
          </h3>
          {children}
        </div>
      )}
    </section>
  );
}

/**
 * Safe version of useSyncScroll that returns null if not in provider.
 */
function useSyncScrollSafe() {
  try {
    return useSyncScroll();
  } catch {
    return null;
  }
}
