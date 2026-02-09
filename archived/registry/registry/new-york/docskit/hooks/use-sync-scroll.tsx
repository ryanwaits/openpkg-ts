'use client';

import {
  createContext,
  type ReactNode,
  type RefObject,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

export interface SyncScrollContextValue {
  /** Currently visible section ID */
  activeSection: string | null;
  /** Register a section to track */
  registerSection: (id: string, ref: RefObject<HTMLElement | null>) => void;
  /** Unregister a section */
  unregisterSection: (id: string) => void;
  /** Scroll right column to section */
  scrollToSection: (id: string) => void;
  /** Register the right column container */
  registerRightColumn: (ref: RefObject<HTMLElement | null>) => void;
}

const SyncScrollContext = createContext<SyncScrollContextValue | null>(null);

export interface SyncScrollProviderProps {
  children: ReactNode;
  /** Root margin for intersection observer (default: '-20% 0px -60% 0px') */
  rootMargin?: string;
  /** Scroll behavior (default: 'smooth') */
  scrollBehavior?: ScrollBehavior;
}

/**
 * Provider for synchronized scrolling between left and right columns.
 * Uses IntersectionObserver to track visible sections on the left,
 * and auto-scrolls the right column to matching examples.
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

    return () => {
      observer.disconnect();
    };
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

/**
 * Hook to access sync scroll context.
 * @throws Error if used outside SyncScrollProvider
 */
export function useSyncScroll(): SyncScrollContextValue {
  const context = useContext(SyncScrollContext);
  if (!context) {
    throw new Error('useSyncScroll must be used within SyncScrollProvider');
  }
  return context;
}

/**
 * Safe variant that returns null if used outside provider.
 */
export function useSyncScrollSafe(): SyncScrollContextValue | null {
  return useContext(SyncScrollContext);
}

/**
 * Hook to register a section for scroll tracking.
 */
export function useSyncSection(id: string): RefObject<HTMLElement | null> {
  const { registerSection, unregisterSection } = useSyncScroll();
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    registerSection(id, ref);
    return () => unregisterSection(id);
  }, [id, registerSection, unregisterSection]);

  return ref;
}
