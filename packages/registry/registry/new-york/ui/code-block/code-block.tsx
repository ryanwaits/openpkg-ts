'use client';

import { ClientDocsKitCode } from '@/registry/new-york/docskit';
import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

export interface CodeBlockProps {
  /** Code content */
  code: string;
  /** Language for syntax highlighting */
  language?: string;
  /** Show line numbers */
  showLineNumbers?: boolean;
  /** Custom className */
  className?: string;
}

/**
 * Syntax-highlighted code block powered by CodeHike.
 * Thin wrapper around docskit's ClientDocsKitCode with a simple interface.
 */
export function CodeBlock({
  code,
  language = 'typescript',
  showLineNumbers = false,
  className,
}: CodeBlockProps): ReactNode {
  const flags = `-c${showLineNumbers ? 'n' : ''}`;

  return (
    <ClientDocsKitCode
      codeblock={{
        value: code,
        lang: language,
        meta: flags,
      }}
      className={cn('my-0 border-[var(--openpkg-border-subtle)]', className)}
    />
  );
}
