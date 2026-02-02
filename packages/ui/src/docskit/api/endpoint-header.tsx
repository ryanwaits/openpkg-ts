'use client';

import { Check, Copy } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/utils';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { EndpointBadge, type HttpMethod } from './endpoint-badge';

export interface EndpointHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  /** HTTP method */
  method: HttpMethod;
  /** API path (e.g., "/v1/customers") */
  path: string;
  /** Show copy button on hover */
  copyable?: boolean;
}

const EndpointHeader: React.ForwardRefExoticComponent<
  EndpointHeaderProps & React.RefAttributes<HTMLDivElement>
> = React.forwardRef<HTMLDivElement, EndpointHeaderProps>(
  ({ className, method, path, copyable = true, ...props }, ref) => {
    const [copied, copy] = useCopyToClipboard();

    const handleCopy = () => {
      copy(path);
    };

    return (
      <div
        ref={ref}
        className={cn(
          'group flex items-center gap-3 py-2 px-3 rounded-lg bg-[var(--openpkg-bg-secondary)] border border-[var(--openpkg-border-subtle)]',
          className,
        )}
        {...props}
      >
        <EndpointBadge method={method} />
        <code className="font-mono text-sm text-[var(--openpkg-text-primary)] flex-1">{path}</code>
        {copyable && (
          <button
            type="button"
            onClick={handleCopy}
            className={cn(
              'p-1.5 rounded text-[var(--openpkg-text-muted)] hover:text-[var(--openpkg-text-primary)]',
              'opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer',
            )}
            aria-label="Copy path"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
        )}
      </div>
    );
  },
);
EndpointHeader.displayName = 'EndpointHeader';

export { EndpointHeader };
