'use client';

import {
  ExpandableParameter,
  ParameterList as DocsKitParameterList,
} from '@openpkg-ts/registry/docskit';
import type { SpecSchema } from '@openpkg-ts/spec';
import { type ReactNode, useCallback } from 'react';
import { useSpecData } from '../data-context';

interface Props {
  props: {
    title?: string | null;
    exportId: string;
    collapseAfter?: number | null;
  };
  children?: ReactNode;
}

export function ParameterListWrapper({ props }: Props) {
  const data = useSpecData();
  const exp = data.exports[props.exportId];

  const resolveRef = useCallback(
    (ref: string): SpecSchema | undefined => {
      const id = ref.replace('#/types/', '');
      const resolved = data.types?.find((t) => t.id === id);
      return resolved?.schema as SpecSchema | undefined;
    },
    [data.types],
  );

  if (!exp || exp.parameters.length === 0) return null;

  return (
    <DocsKitParameterList
      title={props.title ?? 'Parameters'}
      collapseAfter={props.collapseAfter ?? undefined}
    >
      {exp.parameters.map((param) => (
        <ExpandableParameter key={param.name} parameter={param} resolveRef={resolveRef} />
      ))}
    </DocsKitParameterList>
  );
}
