'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';

export interface SyncScrollContextValue {
  activeSection: string | null;
  registerSection: (id: string, ref: RefObject<HTMLElement | null>) => void;
  unregisterSection: (id: string) => void;
  scrollToSection: (id: string) => void;
  registerRightColumn: (ref: RefObject<HTMLElement | null>) => void;
}

const SyncScrollContext = createContext<SyncScrollContextValue | null>(null);

export interface SyncScrollProviderProps {
  children: ReactNode;
  rootMargin?: string;
  scrollBehavior?: ScrollBehavior;
}

/**
 * Provider for synchronized scrolling between left and right columns.
 */
export function SyncScrollProvider({
  children,
  rootMargin = '-20% 0px -60% 0px',
  scrollBehavior = 'smooth',
}: SyncScrollProviderProps): ReactNode {
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const sectionsRef = useRef<Map<string, RefObject<HTMLElement | null>>>(new Map());
  const rightColumnRef = useRef<RefObject<HTMLElement | null> | null>(null);
  const isScrollingRef = useRef(false);

  const registerSection = useCallback((id: string, ref: RefObject<HTMLElement | null>) => {
    sectionsRef.current.set(id, ref);
  }, []);

  const unregisterSection = useCallback((id: string) => {
    sectionsRef.current.delete(id);
  }, []);

  const registerRightColumn = useCallback((ref: RefObject<HTMLElement | null>) => {
    rightColumnRef.current = ref;
  }, []);

  const scrollToSection = useCallback(
    (id: string) => {
      const rightColumn = rightColumnRef.current?.current;
      if (!rightColumn) return;

      const targetExample = rightColumn.querySelector(`[data-section="${id}"]`);
      if (targetExample instanceof HTMLElement) {
        const targetTop = targetExample.offsetTop - 48;
        rightColumn.scrollTo({ top: targetTop, behavior: scrollBehavior });
      }
    },
    [scrollBehavior],
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleIntersect = (entries: IntersectionObserverEntry[]) => {
      if (isScrollingRef.current) return;

      for (const entry of entries) {
        if (entry.isIntersecting) {
          const sectionId = entry.target.getAttribute('data-section');
          if (sectionId) {
            setActiveSection(sectionId);
            scrollToSection(sectionId);
          }
          break;
        }
      }
    };

    const observer = new IntersectionObserver(handleIntersect, {
      rootMargin,
      threshold: 0,
    });

    for (const [_id, ref] of sectionsRef.current) {
      if (ref.current) {
        observer.observe(ref.current);
      }
    }

    return () => observer.disconnect();
  }, [rootMargin, scrollToSection]);

  const value = useMemo(
    () => ({
      activeSection,
      registerSection,
      unregisterSection,
      scrollToSection,
      registerRightColumn,
    }),
    [activeSection, registerSection, unregisterSection, scrollToSection, registerRightColumn],
  );

  return <SyncScrollContext.Provider value={value}>{children}</SyncScrollContext.Provider>;
}

export function useSyncScroll(): SyncScrollContextValue {
  const context = useContext(SyncScrollContext);
  if (!context) {
    throw new Error('useSyncScroll must be used within SyncScrollProvider');
  }
  return context;
}

export function useSyncSection(id: string): RefObject<HTMLElement | null> {
  const { registerSection, unregisterSection } = useSyncScroll();
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    registerSection(id, ref);
    return () => unregisterSection(id);
  }, [id, registerSection, unregisterSection]);

  return ref;
}
