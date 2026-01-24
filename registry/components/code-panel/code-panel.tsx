'use client';

import { type ReactNode, useMemo } from 'react';

export interface CodePanelProps {
  code: string;
  language?: string;
  showLineNumbers?: boolean;
  className?: string;
}

/**
 * Syntax-highlighted code block with Rose Pine color scheme.
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
      className={`openpkg-code-panel bg-[#0f0f18] border border-[#262626] rounded-lg overflow-hidden mb-3 ${className || ''}`}
    >
      <div className="openpkg-code-block p-5 overflow-x-auto">
        <pre className="font-mono text-[13px] leading-relaxed text-[#e4e4e7] m-0">
          {highlightedLines.map((html, i) => (
            <div key={i} className="openpkg-code-line flex">
              {showLineNumbers && (
                <span className="openpkg-line-number w-7 shrink-0 text-[#666666] text-right pr-5 select-none opacity-50">
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

function highlightLine(line: string, language: string): string {
  if (!line.trim()) return '&nbsp;';
  let result = escapeHtml(line);
  if (language === 'typescript' || language === 'javascript' || language === 'ts' || language === 'js') {
    result = highlightTS(result);
  } else if (language === 'json') {
    result = highlightJSON(result);
  }
  return result;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function highlightTS(line: string): string {
  line = line.replace(/(\/\/.*$)/g, '<span style="color:#6e6a86;font-style:italic">$1</span>');
  line = line.replace(/(&#039;[^&#]*&#039;|&quot;[^&]*&quot;|`[^`]*`)/g, '<span style="color:#9ccfd8">$1</span>');
  line = line.replace(/\b(import|export|from|const|let|var|function|async|await|return|if|else|for|while|class|interface|type|extends|implements|new|this|true|false|null|undefined)\b/g, '<span style="color:#c4a7e7">$1</span>');
  line = line.replace(/\b([a-zA-Z_][a-zA-Z0-9_]*)\s*(?=\()/g, '<span style="color:#ebbcba">$1</span>');
  line = line.replace(/\b(\d+\.?\d*)\b/g, '<span style="color:#f6c177">$1</span>');
  line = line.replace(/([{}[\]();:,.])/g, '<span style="color:#6e6a86">$1</span>');
  return line;
}

function highlightJSON(line: string): string {
  line = line.replace(/(&quot;[^&]+&quot;)\s*:/g, '<span style="color:#c4a7e7">$1</span>:');
  line = line.replace(/:\s*(&quot;[^&]*&quot;)/g, ': <span style="color:#9ccfd8">$1</span>');
  line = line.replace(/:\s*(\d+\.?\d*)/g, ': <span style="color:#f6c177">$1</span>');
  line = line.replace(/:\s*(true|false)/g, ': <span style="color:#eb6f92">$1</span>');
  line = line.replace(/:\s*(null)/g, ': <span style="color:#c4a7e7">$1</span>');
  line = line.replace(/([{}[\]:,])/g, '<span style="color:#6e6a86">$1</span>');
  return line;
}
