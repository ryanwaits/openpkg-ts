import { highlight, Inline, type RawCode } from 'codehike/code';
import { theme } from './code.config';

export async function DocsKitInlineCode({ codeblock }: { codeblock: RawCode }): Promise<React.ReactNode> {
  const highlighted = await highlight(codeblock, theme);
  return (
    <Inline
      code={highlighted}
      className="selection:bg-openpkg-code-selection selection:text-current rounded border border-openpkg-code-border px-1 py-0.5 whitespace-nowrap !bg-openpkg-code-bg"
      style={highlighted.style}
    />
  );
}
