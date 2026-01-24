'use client';

import type { ReactNode } from 'react';

export interface APIReferenceLayoutProps {
  /** Left column content (documentation) */
  children: ReactNode;
  /** Right column content (code examples) */
  examples: ReactNode;
  /** Custom className */
  className?: string;
  /** Left column width (default: 58%) */
  leftWidth?: string;
  /** Right column width (default: 42%) */
  rightWidth?: string;
}

/**
 * Two-column layout for API reference with sticky right panel.
 * Left column scrolls normally, right column stays fixed.
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
      className={`openpkg-api-layout grid max-w-[1600px] mx-auto ${className || ''}`}
      style={{
        gridTemplateColumns: `${leftWidth} ${rightWidth}`,
        alignItems: 'start',
      }}
    >
      <div className="openpkg-api-layout-left py-12 px-12 pl-16 border-r border-[#262626]">
        {children}
      </div>
      <div className="openpkg-api-layout-right sticky top-0 h-screen overflow-y-auto py-12 px-12 pl-8 bg-[#0c0c0c]">
        {examples}
      </div>
    </div>
  );
}
