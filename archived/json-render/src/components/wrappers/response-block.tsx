'use client';

import type { ReactNode } from 'react';
import { useSpecData } from '../data-context';

interface Props {
  props: { exportId: string };
  children?: ReactNode;
}

export function ResponseBlockWrapper({ props }: Props) {
  const data = useSpecData();
  const exp = data.exports[props.exportId];
  if (!exp) return null;

  if (!exp.returnTypeString) return null;

  return (
    <div className="returns-section">
      <h3 className="text-xs font-medium tracking-wider text-muted-foreground uppercase font-mono mb-4">
        Returns
      </h3>
      <code className="text-sm font-mono text-foreground bg-muted px-2 py-1 rounded">
        {exp.returnTypeString}
      </code>
      {exp.returnDescription && (
        <div className="mt-2 text-sm text-muted-foreground">{exp.returnDescription}</div>
      )}
    </div>
  );
}
