'use client';

import { Check, Copy } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/utils';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';

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

  const handleCopy = () => {
    copy(jsonString);
  };

  return (
    <div
      className={cn('group rounded-lg border border-[var(--openpkg-border-subtle)] overflow-hidden bg-[var(--openpkg-bg-secondary)]', className)}
    >
      {title && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--openpkg-border-subtle)] bg-[var(--openpkg-bg-tertiary)]">
          <span className="text-xs font-medium text-[var(--openpkg-text-muted)] uppercase tracking-wide">
            {title}
          </span>
          <button
            type="button"
            onClick={handleCopy}
            className="p-1 rounded text-[var(--openpkg-text-muted)] hover:text-[var(--openpkg-text-primary)] opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            aria-label="Copy response"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
        </div>
      )}
      <div className="relative">
        <pre className="p-4 overflow-auto text-sm font-mono leading-relaxed">
          <code>
            <JsonHighlight json={data} />
          </code>
        </pre>
        {!title && (
          <button
            type="button"
            onClick={handleCopy}
            className="absolute top-3 right-3 p-1.5 rounded text-[var(--openpkg-text-muted)] hover:text-[var(--openpkg-text-primary)] opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            aria-label="Copy response"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Simple JSON syntax highlighting component.
 */
function JsonHighlight({ json, depth = 0 }: { json: unknown; depth?: number }): React.ReactNode {
  const indent = '  '.repeat(depth);
  const nextIndent = '  '.repeat(depth + 1);

  if (json === null) {
    return <span className="text-[var(--openpkg-syn-number)]">null</span>;
  }

  if (typeof json === 'boolean') {
    return <span className="text-[var(--openpkg-syn-boolean)]">{json ? 'true' : 'false'}</span>;
  }

  if (typeof json === 'number') {
    return <span className="text-[var(--openpkg-syn-number)]">{json}</span>;
  }

  if (typeof json === 'string') {
    return <span className="text-[var(--openpkg-syn-string)]">"{json}"</span>;
  }

  if (Array.isArray(json)) {
    if (json.length === 0) {
      return <span className="text-[var(--openpkg-syn-punctuation)]">[]</span>;
    }

    return (
      <>
        <span className="text-[var(--openpkg-syn-punctuation)]">[</span>
        {'\n'}
        {json.map((item, i) => (
          <React.Fragment key={i}>
            {nextIndent}
            <JsonHighlight json={item} depth={depth + 1} />
            {i < json.length - 1 && <span className="text-[var(--openpkg-syn-punctuation)]">,</span>}
            {'\n'}
          </React.Fragment>
        ))}
        {indent}
        <span className="text-[var(--openpkg-syn-punctuation)]">]</span>
      </>
    );
  }

  if (typeof json === 'object') {
    const entries = Object.entries(json);
    if (entries.length === 0) {
      return <span className="text-[var(--openpkg-syn-punctuation)]">{'{}'}</span>;
    }

    return (
      <>
        <span className="text-[var(--openpkg-syn-punctuation)]">{'{'}</span>
        {'\n'}
        {entries.map(([key, value], i) => (
          <React.Fragment key={key}>
            {nextIndent}
            <span className="text-[var(--openpkg-syn-property)]">"{key}"</span>
            <span className="text-[var(--openpkg-syn-punctuation)]">: </span>
            <JsonHighlight json={value} depth={depth + 1} />
            {i < entries.length - 1 && <span className="text-[var(--openpkg-syn-punctuation)]">,</span>}
            {'\n'}
          </React.Fragment>
        ))}
        {indent}
        <span className="text-[var(--openpkg-syn-punctuation)]">{'}'}</span>
      </>
    );
  }

  return <span className="text-[var(--openpkg-text-primary)]">{String(json)}</span>;
}
