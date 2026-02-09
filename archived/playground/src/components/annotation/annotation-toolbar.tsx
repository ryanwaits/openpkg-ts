'use client';

import { useAnnotation } from './annotation-context';

export function AnnotationToolbar() {
  const { active, activate, deactivate } = useAnnotation();

  return (
    <div className="absolute bottom-4 right-4 z-50" data-annotation-ui>
      <div className="flex items-center bg-zinc-900 dark:bg-zinc-800 rounded-full shadow-lg">
        {active ? (
          <>
            {/* Active: crosshair highlighted + X close */}
            <button
              type="button"
              onClick={deactivate}
              className="flex items-center justify-center w-8 h-8 text-blue-400 cursor-pointer"
              title="Selection mode active"
            >
              <CrosshairIcon />
            </button>
            <div className="w-px h-4 bg-zinc-700" />
            <button
              type="button"
              onClick={deactivate}
              className="flex items-center justify-center w-8 h-8 text-zinc-400 hover:text-white cursor-pointer"
              title="Exit selection mode"
            >
              <XIcon />
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={activate}
            className="flex items-center justify-center w-9 h-9 text-zinc-400 hover:text-white cursor-pointer"
            title="Enter selection mode"
          >
            <CrosshairIcon />
          </button>
        )}
      </div>
    </div>
  );
}

function CrosshairIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="22" y1="12" x2="18" y2="12" />
      <line x1="6" y1="12" x2="2" y2="12" />
      <line x1="12" y1="6" x2="12" y2="2" />
      <line x1="12" y1="22" x2="12" y2="18" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
