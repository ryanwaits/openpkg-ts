'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import {
  prepareSpecData,
  openpkgComponents,
  SpecDataProvider,
} from '@openpkg-ts/json-render';
import { generateCode } from '@openpkg-ts/json-render/codegen';
import type { Spec } from '@json-render/core';
import { zipSync, strToU8 } from 'fflate';
import { sampleSpec } from '@/lib/sample-spec';
import { highlightTsx } from '@/lib/syntax-highlight';
import {
  AnnotationProvider,
  useAnnotation,
  SelectionOverlay,
  AnnotationPopover,
  AnnotationToolbar,
} from '@/components/annotation';

interface PreviewPanelProps {
  spec: Record<string, unknown> | null;
  isStreaming?: boolean;
  onAnnotationSubmit?: (elementKey: string, instruction: string) => void;
}

export function PreviewPanel({ spec, isStreaming, onAnnotationSubmit }: PreviewPanelProps) {
  return (
    <AnnotationProvider>
      <PreviewPanelInner spec={spec} isStreaming={isStreaming} onAnnotationSubmit={onAnnotationSubmit} />
    </AnnotationProvider>
  );
}

function PreviewPanelInner({ spec, isStreaming, onAnnotationSubmit }: PreviewPanelProps) {
  const [tab, setTab] = useState<'preview' | 'code'>('preview');
  const [codeFile, setCodeFile] = useState(0);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const { active, setRefining, clearSelection } = useAnnotation();
  const data = useMemo(() => prepareSpecData(sampleSpec), []);

  const handleAnnotationSubmit = useCallback(
    async (elementKey: string, instruction: string) => {
      if (!onAnnotationSubmit) return;
      setRefining(true);
      try {
        await onAnnotationSubmit(elementKey, instruction);
        clearSelection();
      } finally {
        setRefining(false);
      }
    },
    [onAnnotationSubmit, setRefining, clearSelection],
  );

  const generatedFiles = useMemo(() => {
    if (!spec) return null;
    try {
      return generateCode(spec as unknown as Spec, data, {
        framework: 'standalone',
        dataStrategy: 'inline',
      });
    } catch {
      return null;
    }
  }, [spec, data]);

  const handleExport = useCallback(
    (framework: 'nextjs' | 'vite' | 'standalone') => {
      if (!spec) return;
      try {
        const files = generateCode(spec as unknown as Spec, data, {
          framework,
          dataStrategy: 'file',
        });

        const zipData: Record<string, Uint8Array> = {};
        for (const file of files) {
          zipData[file.path] = strToU8(file.content);
        }

        const zipped = zipSync(zipData);
        const blob = new Blob([zipped as unknown as ArrayBuffer], { type: 'application/zip' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `openpkg-export-${framework}.zip`;
        a.click();
        URL.revokeObjectURL(url);
      } catch (err) {
        console.error('Export error:', err);
      }
    },
    [spec, data],
  );

  return (
    <>
      {/* Tab bar */}
      <div className="flex items-center px-3 py-2 border-b border-[var(--border)] gap-3">
        <button
          type="button"
          onClick={() => setTab('preview')}
          className={`text-xs font-medium cursor-pointer ${
            tab === 'preview' ? 'text-[var(--foreground)]' : 'text-[var(--muted-foreground)]'
          }`}
        >
          preview
        </button>
        <button
          type="button"
          onClick={() => setTab('code')}
          className={`text-xs font-medium cursor-pointer ${
            tab === 'code' ? 'text-[var(--foreground)]' : 'text-[var(--muted-foreground)]'
          }`}
        >
          code
        </button>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Export dropdown */}
        {spec && (
          <ExportDropdown onExport={handleExport} />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 relative min-h-0">
        <div className={`h-full overflow-auto scrollbar-thin relative ${active ? 'cursor-crosshair' : ''}`} ref={previewContainerRef}>
          {tab === 'preview' && (
            <SpecDataProvider data={data}>
              <PreviewRenderer spec={spec} isStreaming={isStreaming} />
              <SelectionOverlay containerRef={previewContainerRef} />
              {onAnnotationSubmit && (
                <AnnotationPopover
                  containerRef={previewContainerRef}
                  onSubmit={handleAnnotationSubmit}
                />
              )}
            </SpecDataProvider>
          )}
          {tab === 'code' && (
            <CodeViewer
              files={generatedFiles}
              activeIndex={codeFile}
              onSelectFile={setCodeFile}
            />
          )}
        </div>
        {tab === 'preview' && spec && <AnnotationToolbar />}
      </div>
    </>
  );
}

// ─── Export Dropdown ──────────────────────────────────────────

function ExportDropdown({ onExport }: { onExport: (fw: 'nextjs' | 'vite' | 'standalone') => void }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="text-xs font-medium cursor-pointer px-2 py-1 border border-[var(--border)] rounded hover:bg-[var(--muted)] text-[var(--foreground)]"
      >
        Export ↓
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-[var(--background)] border border-[var(--border)] rounded shadow-lg z-50 min-w-[140px]">
          {([
            ['nextjs', 'Next.js'],
            ['vite', 'Vite'],
            ['standalone', 'Standalone'],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => { onExport(key); setOpen(false); }}
              className="block w-full text-left px-3 py-1.5 text-xs hover:bg-[var(--muted)] cursor-pointer text-[var(--foreground)]"
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Code Viewer ─────────────────────────────────────────────

function CodeViewer({
  files,
  activeIndex,
  onSelectFile,
}: {
  files: { path: string; content: string }[] | null;
  activeIndex: number;
  onSelectFile: (i: number) => void;
}) {
  if (!files || files.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--muted-foreground)] text-sm">
        Generate a layout to see the code
      </div>
    );
  }

  const active = files[activeIndex] ?? files[0];

  const highlighted = useMemo(() => {
    return highlightTsx(active.content);
  }, [active.content]);

  return (
    <div className="flex flex-col h-full">
      {/* File tabs */}
      {files.length > 1 && (
        <div className="flex gap-1 px-2 py-1 border-b border-[var(--border)] overflow-x-auto">
          {files.map((f, i) => (
            <button
              key={f.path}
              type="button"
              onClick={() => onSelectFile(i)}
              className={`text-[10px] font-mono px-2 py-0.5 rounded cursor-pointer whitespace-nowrap ${
                i === activeIndex
                  ? 'bg-[var(--muted)] text-[var(--foreground)]'
                  : 'text-[var(--muted-foreground)]'
              }`}
            >
              {f.path}
            </button>
          ))}
        </div>
      )}

      {/* Code content */}
      <pre className="flex-1 p-4 text-[13px] font-mono leading-[1.6] overflow-auto">
        {highlighted}
      </pre>
    </div>
  );
}

// ─── Preview Renderer ────────────────────────────────────────

function PreviewRenderer({ spec, isStreaming }: { spec: Record<string, unknown> | null; isStreaming?: boolean }) {
  if (!spec) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--muted-foreground)] text-sm">
        Generate a layout to see the preview
      </div>
    );
  }

  const root = spec.root as string | undefined;
  const elements = spec.elements as Record<string, SpecElement> | undefined;

  if (!root || !elements || !elements[root]) {
    if (isStreaming) return <StreamingSkeleton />;
    return (
      <div className="p-4 text-sm text-red-500">
        Invalid spec: missing root or elements
      </div>
    );
  }

  return <RenderElement elementKey={root} elements={elements} />;
}

function StreamingSkeleton() {
  return (
    <div className="p-6 space-y-4 animate-pulse">
      <div className="h-6 w-48 bg-[var(--muted)] rounded" />
      <div className="h-4 w-72 bg-[var(--muted)] rounded" />
      <div className="mt-6 space-y-3">
        <div className="h-4 w-full bg-[var(--muted)] rounded" />
        <div className="h-4 w-5/6 bg-[var(--muted)] rounded" />
        <div className="h-4 w-4/6 bg-[var(--muted)] rounded" />
      </div>
      <div className="mt-6 h-32 w-full bg-[var(--muted)] rounded" />
    </div>
  );
}

interface SpecElement {
  key: string;
  type: string;
  props: Record<string, unknown>;
  children: string[];
  parentKey: string;
}

function RenderElement({
  elementKey,
  elements,
}: {
  elementKey: string;
  elements: Record<string, SpecElement>;
}) {
  const element = elements[elementKey];
  if (!element) return null;

  const Component = openpkgComponents[element.type];
  if (!Component) {
    return (
      <div className="p-2 text-xs text-orange-500 border border-orange-200 rounded m-1">
        Unknown component: {element.type}
      </div>
    );
  }

  const childElements = (element.children ?? []).map((childKey) => (
    <RenderElement key={childKey} elementKey={childKey} elements={elements} />
  ));

  return (
    <div data-element-key={elementKey} data-element-type={element.type}>
      <Component props={element.props}>
        {childElements.length > 0 ? childElements : undefined}
      </Component>
    </div>
  );
}
