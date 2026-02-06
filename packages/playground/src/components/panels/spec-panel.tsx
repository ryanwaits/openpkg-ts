'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { highlightJson } from '@/lib/syntax-highlight';

interface SpecPanelProps {
  streamText: string;
  spec: Record<string, unknown> | null;
  isStreaming: boolean;
}

export function SpecPanel({ streamText, spec, isStreaming }: SpecPanelProps) {
  const [tab, setTab] = useState<'json' | 'stream'>('json');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll stream tab
  useEffect(() => {
    if (tab === 'stream' && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [streamText, tab]);

  const formattedSpec = spec ? JSON.stringify(spec, null, 2) : null;
  const highlighted = useMemo(() => {
    if (!formattedSpec) return null;
    return highlightJson(formattedSpec);
  }, [formattedSpec]);

  const highlightedStream = useMemo(() => {
    if (!streamText) return null;
    return highlightJson(streamText);
  }, [streamText]);

  const copyText = tab === 'json' && formattedSpec ? formattedSpec : streamText;

  const handleCopy = () => {
    navigator.clipboard.writeText(copyText);
  };

  return (
    <>
      {/* Tab bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border)]">
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setTab('json')}
            className={`text-xs font-medium cursor-pointer ${
              tab === 'json' ? 'text-[var(--foreground)]' : 'text-[var(--muted-foreground)]'
            }`}
          >
            json
          </button>
          <button
            type="button"
            onClick={() => setTab('stream')}
            className={`text-xs font-medium cursor-pointer ${
              tab === 'stream' ? 'text-[var(--foreground)]' : 'text-[var(--muted-foreground)]'
            }`}
          >
            stream
          </button>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] cursor-pointer"
          title="Copy to clipboard"
        >
          ⎘
        </button>
      </div>

      {/* Content */}
      <div ref={scrollRef} className="flex-1 overflow-auto scrollbar-thin">
        {tab === 'json' && (
          <pre className="p-4 text-[13px] font-mono leading-[1.6]">
            {highlighted ?? (
              <span className="text-[var(--muted-foreground)]">
                {isStreaming ? 'Compiling...' : 'No spec yet'}
              </span>
            )}
          </pre>
        )}
        {tab === 'stream' && (
          <pre className="p-4 text-[13px] font-mono leading-[1.6] whitespace-pre">
            {highlightedStream ?? (
              <span className="text-[var(--muted-foreground)]">
                Waiting for generation...
              </span>
            )}
            {isStreaming && <span className="animate-pulse">▌</span>}
          </pre>
        )}
      </div>
    </>
  );
}
