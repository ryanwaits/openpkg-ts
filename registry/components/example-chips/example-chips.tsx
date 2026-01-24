'use client';

import type { ReactNode } from 'react';

export interface ExampleChip {
  id: string;
  label: string;
}

export interface ExampleChipsProps {
  examples: ExampleChip[];
  activeId: string;
  onSelect: (id: string) => void;
  className?: string;
}

/**
 * Tab-like chips for switching between code examples.
 */
export function ExampleChips({
  examples,
  activeId,
  onSelect,
  className,
}: ExampleChipsProps): ReactNode {
  return (
    <div className={`openpkg-example-chips flex flex-wrap gap-2 mb-5 ${className || ''}`}>
      {examples.map((example) => {
        const isActive = example.id === activeId;
        return (
          <button
            key={example.id}
            type="button"
            onClick={() => onSelect(example.id)}
            className={`openpkg-example-chip text-xs font-medium px-3 py-1.5 border rounded-md cursor-pointer transition-all duration-150 ${
              isActive
                ? 'border-[#666666] text-[#ededed] bg-[#1c1c1c]'
                : 'border-[#333333] text-[#a0a0a0] bg-transparent hover:border-[#666666] hover:text-[#ededed]'
            }`}
            aria-pressed={isActive}
          >
            {example.label}
          </button>
        );
      })}
    </div>
  );
}
