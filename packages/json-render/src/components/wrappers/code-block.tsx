'use client';

import { ClientDocsKitCode } from '@openpkg-ts/registry/docskit';
import type { ReactNode } from 'react';
import { useSpecData } from '../data-context';

interface Props {
  props: {
    exportId: string;
    code?: string | null;
    lang?: string | null;
    title?: string | null;
    flags?: string | null;
  };
  children?: ReactNode;
}

/** Build meta string: `<title> -<flags>`.
 *  Title is a bare string shown in code header. Flags: c=copy, n=lineNumbers, w=wordWrap. */
function buildMeta(title?: string | null, flags?: string | null): string {
  const parts: string[] = [];
  if (title) parts.push(title);
  if (flags) {
    const normalized = flags.replace(/[\s-]+/g, '');
    if (normalized) parts.push(`-${normalized}`);
  }
  return parts.join(' ') || '-c';
}

export function CodeBlockWrapper({ props }: Props) {
  const data = useSpecData();
  const exp = data.exports[props.exportId];
  if (!exp) return null;

  const firstExample = exp.examples[0];
  const code = props.code ?? firstExample?.code ?? exp.signature;
  const lang = props.lang ?? firstExample?.language ?? 'typescript';
  const meta = buildMeta(props.title, props.flags);

  return (
    <ClientDocsKitCode
      codeblock={{
        value: code,
        lang,
        meta,
      }}
    />
  );
}
