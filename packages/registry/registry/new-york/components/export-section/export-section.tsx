'use client';

import type { OpenPkg, SpecExport } from '@openpkg-ts/spec';
import type { ReactNode } from 'react';
import { ClassSection } from '@/registry/new-york/components/class-section/class-section';
import { EnumSection } from '@/registry/new-york/components/enum-section/enum-section';
import { FunctionSection } from '@/registry/new-york/components/function-section/function-section';
import { InterfaceSection } from '@/registry/new-york/components/interface-section/interface-section';
import { VariableSection } from '@/registry/new-york/components/variable-section/variable-section';

export interface ExportSectionProps {
  export: SpecExport;
  spec: OpenPkg;
}

/**
 * Router component that renders the appropriate section based on export kind.
 */
export function ExportSection({ export: exp, spec }: ExportSectionProps): ReactNode {
  const props = { export: exp, spec };

  switch (exp.kind) {
    case 'function':
      return <FunctionSection {...props} />;
    case 'class':
      return <ClassSection {...props} />;
    case 'interface':
    case 'type':
      return <InterfaceSection {...props} />;
    case 'enum':
      return <EnumSection {...props} />;
    default:
      return <VariableSection {...props} />;
  }
}
