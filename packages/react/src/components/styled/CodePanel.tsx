'use client';

import { cn } from '@openpkg-ts/ui/lib/utils';
import { type ReactNode, useMemo } from 'react';

export interface CodePanelProps {
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
 * Syntax-highlighted code block with Rose Pine color scheme.
 * Lightweight client-side highlighting using regex patterns.
 *
 * @example
 * ```tsx
 * <CodePanel
 *   code={`const user = await createUser({ name: 'Jenny' });`}
 *   language="typescript"
 *   showLineNumbers
 * />
 * ```
 */
export function CodePanel({
  code,
  language = 'typescript',
  showLineNumbers = false,
  className,
}: CodePanelProps): ReactNode {
  const lines = useMemo(() => code.split('\n'), [code]);
  const highlightedLines = useMemo(
    () => lines.map((line) => highlightLine(line, language)),
    [lines, language],
  );

  return (
    <div
      className={cn(
        'openpkg-code-panel',
        'bg-[var(--openpkg-bg-code,#0f0f18)]',
        'border border-[var(--openpkg-border-subtle,#262626)]',
        'rounded-lg overflow-hidden',
        'mb-3',
        className,
      )}
    >
      <div className="openpkg-code-block p-5 overflow-x-auto">
        <pre
          className={cn(
            'font-mono text-[13px] leading-relaxed',
            'text-[var(--openpkg-text-code,#e4e4e7)]',
            'm-0',
          )}
        >
          {highlightedLines.map((html, i) => (
            <div key={i} className="openpkg-code-line flex">
              {showLineNumbers && (
                <span
                  className={cn(
                    'openpkg-line-number',
                    'w-7 shrink-0',
                    'text-[var(--openpkg-text-muted,#666666)]',
                    'text-right pr-5',
                    'select-none opacity-50',
                  )}
                >
                  {i + 1}
                </span>
              )}
              <span
                className="openpkg-line-content flex-1"
                dangerouslySetInnerHTML={{ __html: html }}
              />
            </div>
          ))}
        </pre>
      </div>
    </div>
  );
}

// =============================================================================
// Syntax Highlighting (lightweight client-side)
// =============================================================================

function highlightLine(line: string, language: string): string {
  if (!line.trim()) return '&nbsp;';

  let result = escapeHtml(line);

  // Language-specific patterns
  if (language === 'typescript' || language === 'javascript' || language === 'ts' || language === 'js') {
    result = highlightTS(result);
  } else if (language === 'json') {
    result = highlightJSON(result);
  } else if (language === 'sql') {
    result = highlightSQL(result);
  }

  return result;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function highlightTS(line: string): string {
  // Comments
  line = line.replace(
    /(\/\/.*$)/g,
    '<span class="openpkg-syn-comment" style="color:var(--openpkg-syn-comment,#6e6a86);font-style:italic">$1</span>',
  );

  // Strings (single and double quotes, template literals)
  line = line.replace(
    /(&#039;[^&#]*&#039;|&quot;[^&]*&quot;|`[^`]*`)/g,
    '<span class="openpkg-syn-string" style="color:var(--openpkg-syn-string,#9ccfd8)">$1</span>',
  );

  // Keywords
  const keywords = /\b(import|export|from|const|let|var|function|async|await|return|if|else|for|while|class|interface|type|extends|implements|new|this|true|false|null|undefined)\b/g;
  line = line.replace(
    keywords,
    '<span class="openpkg-syn-keyword" style="color:var(--openpkg-syn-keyword,#c4a7e7)">$1</span>',
  );

  // Functions (word followed by parenthesis)
  line = line.replace(
    /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*(?=\()/g,
    '<span class="openpkg-syn-function" style="color:var(--openpkg-syn-function,#ebbcba)">$1</span>',
  );

  // Numbers
  line = line.replace(
    /\b(\d+\.?\d*)\b/g,
    '<span class="openpkg-syn-number" style="color:var(--openpkg-syn-number,#f6c177)">$1</span>',
  );

  // Punctuation
  line = line.replace(
    /([{}[\]();:,.])/g,
    '<span class="openpkg-syn-punctuation" style="color:var(--openpkg-syn-punctuation,#6e6a86)">$1</span>',
  );

  return line;
}

function highlightJSON(line: string): string {
  // Property names
  line = line.replace(
    /(&quot;[^&]+&quot;)\s*:/g,
    '<span class="openpkg-syn-property" style="color:var(--openpkg-syn-property,#c4a7e7)">$1</span>:',
  );

  // String values
  line = line.replace(
    /:\s*(&quot;[^&]*&quot;)/g,
    ': <span class="openpkg-syn-string" style="color:var(--openpkg-syn-string,#9ccfd8)">$1</span>',
  );

  // Numbers
  line = line.replace(
    /:\s*(\d+\.?\d*)/g,
    ': <span class="openpkg-syn-number" style="color:var(--openpkg-syn-number,#f6c177)">$1</span>',
  );

  // Booleans
  line = line.replace(
    /:\s*(true|false)/g,
    ': <span class="openpkg-syn-boolean" style="color:var(--openpkg-syn-boolean,#eb6f92)">$1</span>',
  );

  // Null
  line = line.replace(
    /:\s*(null)/g,
    ': <span class="openpkg-syn-keyword" style="color:var(--openpkg-syn-keyword,#c4a7e7)">$1</span>',
  );

  // Punctuation
  line = line.replace(
    /([{}[\]:,])/g,
    '<span class="openpkg-syn-punctuation" style="color:var(--openpkg-syn-punctuation,#6e6a86)">$1</span>',
  );

  return line;
}

function highlightSQL(line: string): string {
  // Keywords
  const keywords = /\b(SELECT|FROM|WHERE|AND|OR|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|TABLE|INDEX|DROP|ALTER|JOIN|LEFT|RIGHT|INNER|OUTER|ON|AS|ORDER|BY|GROUP|HAVING|LIMIT|OFFSET|PRIMARY|KEY|FOREIGN|REFERENCES|NOT|NULL|DEFAULT|UNIQUE|CHECK|CONSTRAINT)\b/gi;
  line = line.replace(
    keywords,
    '<span class="openpkg-syn-keyword" style="color:var(--openpkg-syn-keyword,#c4a7e7)">$1</span>',
  );

  // Strings
  line = line.replace(
    /(&#039;[^&#]*&#039;)/g,
    '<span class="openpkg-syn-string" style="color:var(--openpkg-syn-string,#9ccfd8)">$1</span>',
  );

  // Numbers
  line = line.replace(
    /\b(\d+\.?\d*)\b/g,
    '<span class="openpkg-syn-number" style="color:var(--openpkg-syn-number,#f6c177)">$1</span>',
  );

  return line;
}
