'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { PreparedSpecData } from '../types';

const SpecDataContext = createContext<PreparedSpecData | null>(null);

export function useSpecData(): PreparedSpecData {
  const ctx = useContext(SpecDataContext);
  if (!ctx) throw new Error('useSpecData must be used within a SpecDataProvider');
  return ctx;
}

export interface SpecDataProviderProps {
  data: PreparedSpecData;
  children: ReactNode;
}

export function SpecDataProvider({ data, children }: SpecDataProviderProps): ReactNode {
  return <SpecDataContext.Provider value={data}>{children}</SpecDataContext.Provider>;
}
