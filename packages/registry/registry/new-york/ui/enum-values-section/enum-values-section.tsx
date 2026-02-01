'use client';

import { cn } from '@openpkg-ts/ui/lib/utils';
import type { ReactNode } from 'react';

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
          'text-[var(--openpkg-text-muted,#666666)]',
          'mb-2.5 pb-2',
          'border-b border-[var(--openpkg-border-subtle,#262626)]',
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
              'bg-[rgba(255,255,255,0.015)]',
              'rounded',
            )}
          >
            <span
              className={cn(
                'openpkg-enum-value-name',
                'font-mono text-xs font-medium',
                'text-[var(--openpkg-syn-string,#9ccfd8)]',
                'bg-[rgba(156,207,216,0.1)]',
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
                  'text-xs text-[var(--openpkg-text-secondary,#a0a0a0)]',
                  'leading-relaxed',
                  '[&_code]:font-mono [&_code]:text-[11px] [&_code]:bg-[var(--openpkg-bg-badge,#262626)] [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded',
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
