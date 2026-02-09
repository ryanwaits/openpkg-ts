'use client';

import type { ReactNode } from 'react';
import { useSpecData } from '../data-context';
import { APISectionSingleWrapper } from './api-section-single';
import { APISectionWrapper } from './api-section';

interface Props {
  props: { exportId: string };
  children?: ReactNode;
}

/**
 * Auto-routes to the appropriate section based on export kind.
 * Uses APISection (two-column) for functions, APISectionSingle for others.
 */
export function ExportSectionWrapper({ props }: Props) {
  const data = useSpecData();
  const exp = data.exports[props.exportId];
  if (!exp) return null;

  // Functions get two-column layout with code panel
  if (exp.kind === 'function') {
    return <APISectionWrapper props={{ exportId: props.exportId }} />;
  }

  // Everything else gets single-column
  return <APISectionSingleWrapper props={{ exportId: props.exportId }} />;
}
