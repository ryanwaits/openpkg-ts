'use client';

import { Check, Copy } from 'lucide-react';
import type * as React from 'react';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { cn } from '@/lib/utils';
import { ClientDocsKitCode } from '../code.client-highlight';

export interface ResponseBlockProps {
  /** Response JSON data */
  data: object;
  /** Optional title (e.g., "Response", "200 OK") */
  title?: string;
  /** Custom className */
  className?: string;
}

/**
 * JSON response preview with syntax highlighting.
 * Displays formatted JSON with copy functionality.
 */
export function ResponseBlock({ data, title, className }: ResponseBlockProps): React.ReactNode {
  const [copied, copy] = useCopyToClipboard();
  const jsonString = JSON.stringify(data, null, 2);

  return (
    <div
      className={cn('group rounded-lg border border-border overflow-hidden bg-muted/30', className)}
    >
      {title && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/50">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {title}
          </span>
          <button
            type="button"
            onClick={() => copy(jsonString)}
            className="p-1 rounded text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            aria-label="Copy response"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
        </div>
      )}
      <ClientDocsKitCode
        codeblock={{
          value: jsonString,
          lang: 'json',
          meta: title ? '' : '-c',
        }}
        className="!my-0 !border-0 !rounded-none"
      />
    </div>
  );
}
