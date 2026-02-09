'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { ClientDocsKitCode } from '../code.client-highlight';

export interface CodeBlockProps {
  /** Code content */
  code: string;
  /** Language for syntax highlighting */
  language?: string;
  /** Title shown in code block header */
  title?: string;
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
  title,
  showLineNumbers = false,
  className,
}: CodeBlockProps): ReactNode {
  const flags = `-c${showLineNumbers ? 'n' : ''}`;
  const meta = title ? `${title} ${flags}` : flags;

  return (
    <ClientDocsKitCode
      codeblock={{
        value: code,
        lang: language,
        meta,
      }}
      className={cn('my-0 border-[var(--openpkg-border-subtle)]', className)}
    />
  );
}
