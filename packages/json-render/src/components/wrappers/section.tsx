'use client';

import { WithHover } from '@openpkg-ts/registry/docskit';
import type { ReactNode } from 'react';
import { useSpecData } from '../data-context';

interface Props {
  props: {
    exportId?: string | null;
    title?: string | null;
    description?: string | null;
    withHover?: boolean | null;
  };
  children?: ReactNode;
}

export function SectionWrapper({ props, children }: Props) {
  const data = useSpecData();
  const exp = props.exportId ? data.exports[props.exportId] : null;

  const title = props.title ?? exp?.title;
  const description = props.description ?? exp?.description;
  const sectionId = exp?.id ?? undefined;

  const content = (
    <section id={sectionId} className="border-b border-[var(--border)] py-8">
      {title && <h2 className="text-xl font-semibold mb-2">{title}</h2>}
      {description && (
        <p className="text-sm text-[var(--muted-foreground)] mb-4">{description}</p>
      )}
      {children}
    </section>
  );

  if (props.withHover) {
    return <WithHover>{content}</WithHover>;
  }

  return content;
}
