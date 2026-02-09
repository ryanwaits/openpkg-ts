'use client';

import {
  APISection as DocsKitAPISection,
  ExpandableParameter,
  ParameterList,
} from '@openpkg-ts/registry/docskit';
import type { SpecSchema } from '@openpkg-ts/spec';
import { type ReactNode, useCallback } from 'react';
import { useSpecData } from '../data-context';

interface Props {
  props: {
    exportId: string;
    codePanelTitle?: string | null;
    code?: string | null;
    codeLang?: string | null;
  };
  children?: ReactNode;
}

export function APISectionWrapper({ props, children }: Props) {
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

  if (!exp) return null;

  // Override first example's code if prop provided
  const examples = props.code
    ? exp.examples.map((ex, i) =>
        i === 0 ? { ...ex, code: props.code!, ...(props.codeLang ? { language: props.codeLang } : {}) } : ex,
      )
    : exp.examples;

  return (
    <DocsKitAPISection
      title={exp.title}
      id={exp.id}
      description={exp.description}
      examples={examples}
      codePanelTitle={props.codePanelTitle ?? undefined}
    >
      <ParameterList title="Parameters">
        {exp.parameters.map((param) => (
          <ExpandableParameter key={param.name} parameter={param} resolveRef={resolveRef} />
        ))}
      </ParameterList>
      {children}
    </DocsKitAPISection>
  );
}
