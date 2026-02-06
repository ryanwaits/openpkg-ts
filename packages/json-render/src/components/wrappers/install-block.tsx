'use client';

import { PackageInstall } from '@openpkg-ts/registry/docskit';
import type { ReactNode } from 'react';
import { useSpecData } from '../data-context';

interface Props {
  props: {
    managers?: string[] | null;
  };
  children?: ReactNode;
}

export function InstallBlockWrapper({ props }: Props) {
  const data = useSpecData();

  return (
    <PackageInstall
      package={data.packageName}
      managers={props.managers as ('npm' | 'bun' | 'pnpm' | 'yarn')[] | undefined}
    />
  );
}
