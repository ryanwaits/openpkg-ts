import { type AnnotationHandler, highlight, Pre, type RawCode } from 'codehike/code';

import { cn } from '@/lib/utils';
import { type CodeInfo, extractFlags, flagsToOptions, PRE_CLASSNAME, theme } from './code.config';
import { CodeHeader } from './code-header';
import { CopyButton } from './code.copy';
import { getHandlers } from './code.handlers';
import { CodeIcon } from './code.icon';

export async function DocsKitCode(props: {
  codeblock: RawCode;
  handlers?: AnnotationHandler[];
  className?: string;
}): Promise<React.ReactNode> {
  const { codeblock, className, ...rest } = props;
  const group = await toCodeGroup({ codeblocks: [codeblock], ...rest });
  return <SingleCode group={group} className={className} />;
}

export async function SingleCode(props: {
  group: CodeInfo;
  className?: string;
}): Promise<React.ReactNode> {
  const { pre, title, code, icon, options } = props.group.tabs[0];

  const showCopy = options?.copyButton;

  return (
    <div
      className={cn(
        'group rounded overflow-hidden relative border-openpkg-code-border flex flex-col border my-4 not-prose',
        props.className,
      )}
    >
      <CodeHeader title={title} icon={icon} />
      <div className="relative flex items-start">
        {pre}
        {showCopy && (
          <CopyButton
            text={code}
            variant="floating"
            className={cn('absolute right-3 z-10 text-openpkg-code-text-inactive', 'top-3')}
          />
        )}
      </div>
    </div>
  );
}

export async function toCodeGroup(props: {
  codeblocks: RawCode[];
  flags?: string;
  storage?: string;
  handlers?: AnnotationHandler[];
}): Promise<CodeInfo> {
  // Strip leading dash from flags if present (e.g., "-c" -> "c")
  const rawFlags = props.flags?.startsWith('-') ? props.flags.slice(1) : props.flags;
  const groupOptions = flagsToOptions(rawFlags);

  const tabs = await Promise.all(
    props.codeblocks.map(async (tab) => {
      const { flags, title } = extractFlags(tab);
      const tabOptions = flagsToOptions(flags);
      const options = { ...groupOptions, ...tabOptions };

      const highlighted = await highlight({ ...tab, lang: tab.lang || 'txt' }, theme);
      const handlers = getHandlers(options);
      if (props.handlers) {
        handlers.push(...props.handlers);
      }
      const { background: _background, ...highlightedStyle } = highlighted.style;
      return {
        options,
        title,
        code: highlighted.code,
        icon: <CodeIcon title={title} lang={tab.lang} className="opacity-60" />,
        lang: tab.lang,
        pre: (
          <Pre
            code={highlighted}
            className={PRE_CLASSNAME}
            style={highlightedStyle}
            handlers={handlers}
          />
        ),
      };
    }),
  );

  return {
    storage: props.storage,
    options: groupOptions,
    tabs,
  };
}

