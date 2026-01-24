'use client';

import type { ReactNode } from 'react';

export interface EnumValue {
  value: string;
  description?: string;
}

export interface EnumValuesSectionProps {
  values: EnumValue[];
  header?: string;
  className?: string;
}

/**
 * Enum values section showing possible values with optional descriptions.
 */
export function EnumValuesSection({
  values,
  header = 'Possible values',
  className,
}: EnumValuesSectionProps): ReactNode {
  if (values.length === 0) return null;

  return (
    <div className={`openpkg-enum-section mt-3 ${className || ''}`}>
      <div className="openpkg-enum-header text-[11px] font-medium text-[#666666] mb-2.5 pb-2 border-b border-[#262626]">
        {header}
      </div>

      <div className="openpkg-enum-values flex flex-col gap-0.5">
        {values.map((item) => (
          <div
            key={item.value}
            className="openpkg-enum-value py-2.5 px-3 bg-[rgba(255,255,255,0.015)] rounded"
          >
            <span className="openpkg-enum-value-name font-mono text-xs font-medium text-[#9ccfd8] bg-[rgba(156,207,216,0.1)] px-1.5 py-0.5 rounded inline-block mb-1">
              {item.value}
            </span>

            {item.description && (
              <p className="openpkg-enum-value-description text-xs text-[#a0a0a0] leading-relaxed">
                {item.description}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
