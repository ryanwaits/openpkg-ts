'use client';

import { Check, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';

export interface ImportSectionProps {
  /** Import statement text */
  importStatement: string;
  /** Custom className */
  className?: string;
}

/**
 * Displays a copyable import statement with one-click copy.
 * Monospace styling with copy button.
 */
export function ImportSection({ importStatement, className }: ImportSectionProps): React.ReactNode {
  const [copied, copy] = useCopyToClipboard();

  const handleCopy = () => {
    copy(importStatement);
  };

  return (
    <div
      className={cn(
        'group flex items-center justify-between gap-3',
        'rounded-lg border border-border bg-muted/30 px-4 py-3',
        className,
      )}
    >
      <code className="font-mono text-sm text-foreground overflow-x-auto">{importStatement}</code>
      <button
        type="button"
        onClick={handleCopy}
        className={cn(
          'shrink-0 p-1.5 rounded',
          'text-muted-foreground hover:text-foreground',
          'opacity-0 group-hover:opacity-100 transition-opacity duration-200',
          'cursor-pointer',
        )}
        aria-label="Copy import statement"
      >
        {copied ? <Check size={16} /> : <Copy size={16} />}
      </button>
    </div>
  );
}
