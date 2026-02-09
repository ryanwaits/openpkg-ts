'use client';

import {
  APISectionSingle as DocsKitAPISectionSingle,
  ExpandableParameter,
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

export function APISectionSingleWrapper({ props }: Props) {
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

  const firstExample = exp.examples[0];

  return (
    <DocsKitAPISectionSingle
      title={exp.title}
      id={exp.id}
      description={exp.description}
      codePanelTitle={props.codePanelTitle ?? undefined}
      example={{
        code: props.code ?? firstExample?.code ?? exp.signature,
        lang: props.codeLang ?? firstExample?.language ?? 'typescript',
      }}
      parameters={
        exp.parameters.length > 0 ? (
          <>
            {exp.parameters.map((param) => (
              <ExpandableParameter key={param.name} parameter={param} resolveRef={resolveRef} />
            ))}
          </>
        ) : undefined
      }
      returns={
        exp.returnTypeString
          ? { type: exp.returnTypeString, description: exp.returnDescription }
          : undefined
      }
    />
  );
}
