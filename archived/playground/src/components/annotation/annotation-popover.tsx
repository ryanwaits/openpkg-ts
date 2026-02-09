'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAnnotation } from './annotation-context';

interface AnnotationPopoverProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  onSubmit: (elementKey: string, instruction: string) => void;
}

export function AnnotationPopover({ containerRef, onSubmit }: AnnotationPopoverProps) {
  const { active, selectedKey, isRefining, clearSelection } = useAnnotation();
  const [instruction, setInstruction] = useState('');
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Position popover below selected element
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !selectedKey) {
      setPosition(null);
      return;
    }
    const el = container.querySelector(`[data-element-key="${selectedKey}"]`) as HTMLElement | null;
    if (!el) {
      setPosition(null);
      return;
    }
    const cRect = container.getBoundingClientRect();
    const eRect = el.getBoundingClientRect();
    setPosition({
      top: eRect.bottom - cRect.top + container.scrollTop + 8,
      left: Math.max(8, eRect.left - cRect.left + container.scrollLeft),
    });
  }, [selectedKey, containerRef]);

  // Focus textarea when popover opens
  useEffect(() => {
    if (position && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [position]);

  // Reset instruction when selection changes
  useEffect(() => {
    setInstruction('');
  }, [selectedKey]);

  const handleSubmit = useCallback(() => {
    if (!selectedKey || !instruction.trim()) return;
    onSubmit(selectedKey, instruction.trim());
    setInstruction('');
  }, [selectedKey, instruction, onSubmit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSubmit();
      }
      if (e.key === 'Escape') {
        clearSelection();
      }
    },
    [handleSubmit, clearSelection],
  );

  if (!active || !selectedKey || !position) return null;

  return (
    <div
      className="absolute z-50"
      style={{ top: position.top, left: position.left }}
      data-annotation-ui
    >
      <div className="w-[280px] bg-white dark:bg-[var(--background)] border border-[var(--border)] rounded-lg shadow-lg p-3">
        {/* Header */}
        <div className="flex items-center gap-1.5 mb-2">
          <span className="text-[10px] font-mono text-[var(--muted-foreground)] truncate">
            {selectedKey}
          </span>
        </div>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe the change..."
          disabled={isRefining}
          rows={3}
          className="w-full text-sm bg-[var(--muted)] border border-[var(--border)] rounded-md px-2.5 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-[var(--muted-foreground)] disabled:opacity-50"
        />

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 mt-2">
          <button
            type="button"
            onClick={clearSelection}
            disabled={isRefining}
            className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isRefining || !instruction.trim()}
            className="text-xs font-medium bg-blue-600 text-white px-3 py-1.5 rounded-md hover:bg-blue-700 cursor-pointer disabled:opacity-50 flex items-center gap-1"
          >
            {isRefining ? (
              <>
                <LoadingSpinner />
                Refining…
              </>
            ) : (
              <>
                Add
                <span className="text-[10px]">→</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
