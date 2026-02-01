'use client';

import { cn } from '@openpkg-ts/ui/lib/utils';
import type { ReactNode } from 'react';

export interface ExampleChip {
  /** Unique identifier */
  id: string;
  /** Display label */
  label: string;
}

export interface ExampleChipsProps {
  /** Available examples */
  examples: ExampleChip[];
  /** Currently active example ID */
  activeId: string;
  /** Selection callback */
  onSelect: (id: string) => void;
  /** Custom className */
  className?: string;
}

/**
 * Tab-like chips for switching between code examples.
 * Used in the right column to select different example variations.
 */
export function ExampleChips({
  examples,
  activeId,
  onSelect,
  className,
}: ExampleChipsProps): ReactNode {
  return (
    <div className={cn('openpkg-example-chips', 'flex flex-wrap gap-2 mb-5', className)}>
      {examples.map((example) => {
        const isActive = example.id === activeId;
        return (
          <button
            key={example.id}
            type="button"
            onClick={() => onSelect(example.id)}
            className={cn(
              'openpkg-example-chip',
              'text-xs font-medium',
              'px-3 py-1.5',
              'border rounded-md',
              'cursor-pointer',
              'transition-all duration-150',
              isActive
                ? [
                    'border-[var(--openpkg-border-chip-active,#666666)]',
                    'text-[var(--openpkg-text-primary,#ededed)]',
                    'bg-[var(--openpkg-bg-tertiary,#1c1c1c)]',
                  ]
                : [
                    'border-[var(--openpkg-border-chip,#333333)]',
                    'text-[var(--openpkg-text-secondary,#a0a0a0)]',
                    'bg-transparent',
                    'hover:border-[var(--openpkg-text-muted,#666666)]',
                    'hover:text-[var(--openpkg-text-primary,#ededed)]',
                  ],
            )}
            aria-pressed={isActive}
          >
            {example.label}
          </button>
        );
      })}
    </div>
  );
}
