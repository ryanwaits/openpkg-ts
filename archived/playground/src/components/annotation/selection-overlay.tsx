'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAnnotation } from './annotation-context';

interface OverlayRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function SelectionOverlay({ containerRef }: { containerRef: React.RefObject<HTMLDivElement | null> }) {
  const { active, hoveredKey, selectedKey, setHoveredKey, selectElement } = useAnnotation();
  const [hoverRect, setHoverRect] = useState<OverlayRect | null>(null);
  const [selectRect, setSelectRect] = useState<OverlayRect | null>(null);
  const [hoverType, setHoverType] = useState<string | null>(null);
  const [selectType, setSelectType] = useState<string | null>(null);
  const rafRef = useRef<number>(0);

  const getRelativeRect = useCallback(
    (el: HTMLElement): OverlayRect | null => {
      const container = containerRef.current;
      if (!container) return null;
      const cRect = container.getBoundingClientRect();
      const eRect = el.getBoundingClientRect();
      return {
        top: eRect.top - cRect.top + container.scrollTop,
        left: eRect.left - cRect.left + container.scrollLeft,
        width: eRect.width,
        height: eRect.height,
      };
    },
    [containerRef],
  );

  // Track hover
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !active) {
      setHoverRect(null);
      return;
    }

    const onMouseMove = (e: MouseEvent) => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const target = e.target as HTMLElement;
        if (target.closest('[data-annotation-ui]')) return;
        const el = target.closest('[data-element-key]') as HTMLElement | null;
        if (!el) {
          setHoveredKey(null);
          setHoverRect(null);
          setHoverType(null);
          return;
        }
        const key = el.dataset.elementKey!;
        if (key === selectedKey) {
          setHoverRect(null);
          return;
        }
        setHoveredKey(key);
        setHoverType(el.dataset.elementType ?? null);
        setHoverRect(getRelativeRect(el));
      });
    };

    const onMouseLeave = () => {
      setHoveredKey(null);
      setHoverRect(null);
      setHoverType(null);
    };

    container.addEventListener('mousemove', onMouseMove);
    container.addEventListener('mouseleave', onMouseLeave);
    return () => {
      cancelAnimationFrame(rafRef.current);
      container.removeEventListener('mousemove', onMouseMove);
      container.removeEventListener('mouseleave', onMouseLeave);
    };
  }, [active, selectedKey, containerRef, getRelativeRect, setHoveredKey]);

  // Track click
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !active) return;

    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Don't intercept clicks on annotation UI (toolbar, popover)
      if (target.closest('[data-annotation-ui]')) return;

      e.preventDefault();
      e.stopPropagation();
      const el = target.closest('[data-element-key]') as HTMLElement | null;
      if (!el) return;
      const key = el.dataset.elementKey!;
      selectElement(key);
      setSelectType(el.dataset.elementType ?? null);
      setSelectRect(getRelativeRect(el));
      setHoverRect(null);
    };

    container.addEventListener('click', onClick, true);
    return () => container.removeEventListener('click', onClick, true);
  }, [active, containerRef, getRelativeRect, selectElement]);

  // Update selected rect on scroll/resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !selectedKey) {
      setSelectRect(null);
      return;
    }
    const el = container.querySelector(`[data-element-key="${selectedKey}"]`) as HTMLElement | null;
    if (!el) {
      setSelectRect(null);
      return;
    }
    setSelectType(el.dataset.elementType ?? null);
    setSelectRect(getRelativeRect(el));
  }, [selectedKey, containerRef, getRelativeRect]);

  if (!active) return null;

  return (
    <>
      {/* Hover overlay */}
      {hoverRect && hoveredKey && (
        <div
          className="pointer-events-none absolute z-40 border-2 border-blue-500 rounded-sm transition-all duration-75"
          style={{
            top: hoverRect.top,
            left: hoverRect.left,
            width: hoverRect.width,
            height: hoverRect.height,
            backgroundColor: 'rgba(59, 130, 246, 0.04)',
          }}
        >
          {hoverType && (
            <span className="absolute -top-5 left-1 text-[10px] font-mono bg-blue-500 text-white px-1.5 py-0.5 rounded-sm leading-none">
              {hoverType}
            </span>
          )}
        </div>
      )}

      {/* Selected overlay */}
      {selectRect && selectedKey && (
        <div
          className="pointer-events-none absolute z-40 border-2 border-blue-600 rounded-sm"
          style={{
            top: selectRect.top,
            left: selectRect.left,
            width: selectRect.width,
            height: selectRect.height,
            backgroundColor: 'rgba(59, 130, 246, 0.06)',
          }}
        >
          {selectType && (
            <span className="absolute -top-5 left-1 text-[10px] font-mono bg-blue-600 text-white px-1.5 py-0.5 rounded-sm leading-none">
              {selectType}
            </span>
          )}
        </div>
      )}
    </>
  );
}
