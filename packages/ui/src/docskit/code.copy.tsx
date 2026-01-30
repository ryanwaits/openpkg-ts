'use client';

import { Check, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';

export function CopyButton({
  text,
  className,
  variant = 'floating',
}: {
  text: string;
  className?: string;
  variant?: 'floating' | 'inline';
}): React.JSX.Element {
  const [copied, copy] = useCopyToClipboard();

  return (
    <button
      type="button"
      className={cn(
        'cursor-pointer transition-opacity duration-200',
        variant === 'floating' && [
          'size-8 flex items-center justify-center',
          'rounded border border-dk-border bg-dk-background',
          'opacity-0 group-hover:opacity-100',
        ],
        variant === 'inline' && 'rounded',
        className,
      )}
      onClick={() => copy(text)}
      aria-label="Copy to clipboard"
    >
      {copied ? <Check size={16} className="block" /> : <Copy size={16} className="block" />}
    </button>
  );
}
