'use client';

import { type FormEvent, useRef, useState } from 'react';
import type { Version } from '../playground';

const PRESETS = [
  'Stripe-style two-column API reference',
  'Single-column docs like Mintlify',
  'Export index page with search',
  'Group functions and types separately',
];

interface VersionsPanelProps {
  versions: Version[];
  activeVersionId: string | null;
  onSelectVersion: (id: string) => void;
  onSend: (prompt: string) => void;
  onAbort: () => void;
  isStreaming: boolean;
}

export function VersionsPanel({
  versions,
  activeVersionId,
  onSelectVersion,
  onSend,
  onAbort,
  isStreaming,
}: VersionsPanelProps) {
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    onSend(trimmed);
    setInput('');
  };

  return (
    <>
      {/* Header */}
      <div className="px-3 py-2 border-b border-[var(--border)] text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">
        versions
      </div>

      {/* Version list */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {versions.length === 0 && (
          <div className="flex flex-col items-center justify-center flex-1 px-4 py-12 gap-4">
            <p className="text-sm text-[var(--muted-foreground)] text-center">
              Describe what you want to build, then iterate on it.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => onSend(preset)}
                  disabled={isStreaming}
                  className="px-3 py-1.5 text-xs border border-[var(--border)] rounded-full text-[var(--foreground)] hover:bg-[var(--muted)] cursor-pointer transition-colors disabled:opacity-50"
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>
        )}
        {versions.map((version, i) => (
          <button
            key={version.id}
            type="button"
            onClick={() => onSelectVersion(version.id)}
            className={`w-full text-left px-3 py-2.5 text-sm border-b border-[var(--border)] cursor-pointer transition-colors ${
              activeVersionId === version.id
                ? 'bg-[var(--accent)] text-[var(--accent-foreground)]'
                : 'hover:bg-[var(--muted)]'
            }`}
          >
            <span className="text-[var(--muted-foreground)] mr-2">v{i + 1}</span>
            <span className="truncate">{version.prompt}</span>
          </button>
        ))}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="border-t border-[var(--border)] p-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder="Describe changes..."
            rows={2}
            className="flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-[var(--muted-foreground)] border border-[var(--border)] rounded-md px-3 py-2"
          />
          <button
            type={isStreaming ? 'button' : 'submit'}
            onClick={isStreaming ? onAbort : undefined}
            className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-[var(--primary)] text-[var(--primary-foreground)] cursor-pointer"
          >
            {isStreaming ? '■' : '→'}
          </button>
        </div>
      </form>
    </>
  );
}
