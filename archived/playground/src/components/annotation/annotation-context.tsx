'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

interface AnnotationState {
  active: boolean;
  hoveredKey: string | null;
  selectedKey: string | null;
  isRefining: boolean;
}

interface AnnotationActions {
  activate: () => void;
  deactivate: () => void;
  setHoveredKey: (key: string | null) => void;
  selectElement: (key: string) => void;
  clearSelection: () => void;
  setRefining: (v: boolean) => void;
}

type AnnotationContextValue = AnnotationState & AnnotationActions;

const AnnotationContext = createContext<AnnotationContextValue | null>(null);

export function AnnotationProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState(false);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [isRefining, setRefining] = useState(false);

  const activate = useCallback(() => setActive(true), []);
  const deactivate = useCallback(() => {
    setActive(false);
    setHoveredKey(null);
    setSelectedKey(null);
  }, []);
  const selectElement = useCallback((key: string) => {
    setSelectedKey(key);
    setHoveredKey(null);
  }, []);
  const clearSelection = useCallback(() => setSelectedKey(null), []);

  const value = useMemo<AnnotationContextValue>(
    () => ({
      active,
      hoveredKey,
      selectedKey,
      isRefining,
      activate,
      deactivate,
      setHoveredKey,
      selectElement,
      clearSelection,
      setRefining,
    }),
    [active, hoveredKey, selectedKey, isRefining, activate, deactivate, selectElement, clearSelection],
  );

  return <AnnotationContext value={value}>{children}</AnnotationContext>;
}

export function useAnnotation() {
  const ctx = useContext(AnnotationContext);
  if (!ctx) throw new Error('useAnnotation must be used within AnnotationProvider');
  return ctx;
}
