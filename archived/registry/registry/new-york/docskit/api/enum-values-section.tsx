'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface EnumValue {
  /** Enum value */
  value: string;
  /** Optional description */
  description?: string;
}

export interface EnumValuesSectionProps {
  /** Enum values to display */
  values: EnumValue[];
  /** Section header (default: "Possible values") */
  header?: string;
  /** Custom className */
  className?: string;
}

/**
 * Enum values section showing possible values with optional descriptions.
 * Used inside parameter items to show enum options.
 */
export function EnumValuesSection({
  values,
  header = 'Possible values',
  className,
}: EnumValuesSectionProps): ReactNode {
  if (values.length === 0) return null;

  return (
    <div className={cn('openpkg-enum-section', 'mt-3', className)}>
      <div
        className={cn(
          'openpkg-enum-header',
          'text-[11px] font-medium',
          'text-[var(--openpkg-text-muted)]',
          'mb-2.5 pb-2',
          'border-b border-[var(--openpkg-border-subtle)]',
        )}
      >
        {header}
      </div>

      <div className="openpkg-enum-values flex flex-col gap-0.5">
        {values.map((item) => (
          <div
            key={item.value}
            className={cn(
              'openpkg-enum-value',
              'py-2.5 px-3',
              'bg-[var(--openpkg-bg-secondary)]',
              'rounded',
            )}
          >
            <span
              className={cn(
                'openpkg-enum-value-name',
                'font-mono text-xs font-medium',
                'text-[var(--openpkg-syn-string)]',
                'bg-[var(--openpkg-bg-badge)]',
                'px-1.5 py-0.5 rounded',
                'inline-block mb-1',
              )}
            >
              {item.value}
            </span>

            {item.description && (
              <p
                className={cn(
                  'openpkg-enum-value-description',
                  'text-xs text-[var(--openpkg-text-secondary)]',
                  'leading-relaxed',
                  '[&_code]:font-mono [&_code]:text-[11px] [&_code]:bg-[var(--openpkg-bg-badge)] [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded',
                )}
              >
                {item.description}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
