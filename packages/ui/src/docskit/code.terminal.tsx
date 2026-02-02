import { type AnnotationHandler, highlight, Pre, type RawCode } from 'codehike/code';

import { cn } from '@/lib/utils';
import { flagsToOptions, theme } from './code.config';
import { CopyButton } from './code.copy';
import { getHandlers } from './code.handlers';

/**
 * Terminal-style code block with macOS window controls.
 *
 * @example
 * ```tsx
 * <Terminal
 *   codeblock={{
 *     value: "npm install @opencode-ai/sdk",
 *     lang: "bash",
 *     meta: "-c",
 *   }}
 * />
 * ```
 */
export async function Terminal(props: { codeblock: RawCode; handlers?: AnnotationHandler[] }): Promise<React.ReactNode> {
  const { codeblock, handlers: extraHandlers } = props;
  const { flags } = extractFlags(codeblock);
  const options = flagsToOptions(flags);

  const highlighted = await highlight({ ...codeblock, lang: codeblock.lang || 'bash' }, theme);

  const handlers = getHandlers(options);
  if (extraHandlers) {
    handlers.push(...extraHandlers);
  }

  const { background: _background, ...highlightedStyle } = highlighted.style;
  const showCopy = options?.copyButton;
  const isMultiLine = highlighted.code.includes('\n');

  return (
    <div className="group rounded overflow-hidden relative border-openpkg-code-border flex flex-col border my-4 not-prose">
      {/* Terminal header with macOS dots */}
      <div
        className={cn(
          'border-b border-openpkg-code-border bg-openpkg-code-header',
          'w-full h-9 flex items-center justify-center shrink-0',
          'relative',
        )}
      >
        {/* macOS window controls (3 dots) */}
        <div className="absolute left-3 flex items-center gap-2">
          <div className="size-3 rounded-full bg-openpkg-code-text-inactive/30" />
          <div className="size-3 rounded-full bg-openpkg-code-text-inactive/30" />
          <div className="size-3 rounded-full bg-openpkg-code-text-inactive/30" />
        </div>
        <span className="sr-only">Terminal window</span>
      </div>

      {/* Code content */}
      <div className="relative flex items-start">
        <Pre
          code={highlighted}
          className="overflow-auto px-0 py-3 m-0 rounded-none !bg-openpkg-code-bg selection:bg-openpkg-code-selection selection:text-current max-h-full flex-1"
          style={highlightedStyle}
          handlers={handlers}
        />
        {showCopy && (
          <CopyButton
            text={highlighted.code}
            variant="floating"
            className={cn(
              'absolute right-3 z-10 text-openpkg-code-text-inactive',
              isMultiLine ? 'top-3' : 'top-1/2 -translate-y-1/2',
            )}
          />
        )}
      </div>
    </div>
  );
}

function extractFlags(codeblock: RawCode) {
  const meta = codeblock.meta || '';
  const flagMatch = meta.split(' ').find((flag) => flag.startsWith('-'));
  const flags = flagMatch ? flagMatch.slice(1) : '';
  return { flags };
}
