'use client';

import { type RawCode } from 'codehike/code';
import { CheckCircle2, Loader2, Play, XCircle } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { ClientDocsKitCode } from '@openpkg-ts/ui/docskit';
import { CollapsiblePanel } from '@openpkg-ts/ui/docskit';

export interface RunnableSnippetProps {
  /** Code to display */
  code: string;
  /** Language for syntax highlighting */
  language?: string;
  /** Optional title */
  title?: string;
  /** For demo: mock execution state */
  mockState?: 'idle' | 'running' | 'success' | 'error';
  /** For demo: mock output data */
  mockOutput?: string;
  /** Custom className */
  className?: string;
}

/**
 * Interactive code block with run button and output display.
 * Currently uses mock states; will be wired to sandbox execution in Phase 2.
 */
export function RunnableSnippet({
  code,
  language = 'typescript',
  title,
  mockState = 'idle',
  mockOutput,
  className,
}: RunnableSnippetProps): React.ReactNode {
  const [state, setState] = useState<'idle' | 'running' | 'success' | 'error'>(mockState);
  const [output, setOutput] = useState<string | null>(mockOutput ?? null);
  const [duration, setDuration] = useState<number>(0);

  const handleRun = () => {
    setState('running');
    setOutput(null);

    // Mock execution - will be replaced with real sandbox in Phase 2
    const startTime = Date.now();
    setTimeout(() => {
      const elapsed = Date.now() - startTime;
      setDuration(elapsed);

      if (mockState === 'error') {
        setState('error');
        setOutput(mockOutput ?? 'Error: Execution failed');
      } else {
        setState('success');
        setOutput(
          mockOutput ?? JSON.stringify({ result: 'success', timestamp: new Date().toISOString() }, null, 2),
        );
      }
    }, 1200);
  };

  const codeblock: RawCode = {
    value: code,
    lang: language,
    meta: title,
  };

  return (
    <div className={cn('relative', className)}>
      {/* Code display with run button */}
      <div className="relative group">
        <ClientDocsKitCode codeblock={codeblock} />

        {/* Run button - positioned like CopyButton */}
        <button
          type="button"
          onClick={handleRun}
          disabled={state === 'running'}
          className={cn(
            'absolute right-3 top-3 z-10',
            'size-8 flex items-center justify-center',
            'rounded border border-openpkg-code-border bg-openpkg-code-bg',
            'text-openpkg-code-text-inactive',
            'cursor-pointer transition-opacity duration-200',
            'opacity-0 group-hover:opacity-100',
            state === 'running' && 'cursor-not-allowed opacity-100',
          )}
          aria-label="Run code"
        >
          {state === 'running' ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Play size={16} className="fill-current" />
          )}
        </button>
      </div>

      {/* Output panel - shown after execution */}
      {output && (
        <div className="-mt-4">
          <CollapsiblePanel
            title={`${state === 'success' ? '✓ Success' : '✕ Error'} | ${duration}ms`}
            defaultExpanded={true}
          >
            <pre className="p-4 m-0 text-xs font-mono overflow-auto max-h-[400px]">{output}</pre>
          </CollapsiblePanel>
        </div>
      )}
    </div>
  );
}
