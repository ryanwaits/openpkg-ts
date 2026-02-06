'use client';

import { APIReferencePage as DocsKitAPIReferencePage } from '@openpkg-ts/registry/docskit';
import type { ReactNode } from 'react';

interface Props {
  props: {
    title: string;
    description?: string | null;
    theme?: 'default' | 'single' | null;
  };
  children?: ReactNode;
}

export function APIReferencePageWrapper({ props, children }: Props) {
  return (
    <DocsKitAPIReferencePage
      title={props.title}
      description={props.description ?? undefined}
      theme={props.theme ?? 'default'}
    >
      {children}
    </DocsKitAPIReferencePage>
  );
}
