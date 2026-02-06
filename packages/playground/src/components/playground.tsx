'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createSpecStreamCompiler } from '@json-render/core';
import { VersionsPanel } from './panels/versions-panel';
import { PreviewPanel } from './panels/preview-panel';

export interface Version {
  id: string;
  prompt: string;
  spec: Record<string, unknown> | null;
  timestamp: number;
}

/** Strip markdown code fences the LLM sometimes wraps around JSONL output */
function stripCodeFences(text: string): string {
  return text.replace(/^```(?:json|jsonl)?\n?/gm, '').replace(/\n?```\s*$/gm, '');
}

export function Playground() {
  const [versions, setVersions] = useState<Version[]>([]);
  const [activeVersionId, setActiveVersionId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [liveSpec, setLiveSpec] = useState<Record<string, unknown> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const latestSpecRef = useRef<Record<string, unknown> | null>(null);

  // Resizable panels
  const containerRef = useRef<HTMLDivElement>(null);
  const [leftWidth, setLeftWidth] = useState(280); // px
  const dragRef = useRef<{
    startX: number;
    startLeft: number;
    containerWidth: number;
  } | null>(null);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const container = containerRef.current;
      if (!container) return;
      dragRef.current = {
        startX: e.clientX,
        startLeft: leftWidth,
        containerWidth: container.offsetWidth,
      };
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [leftWidth],
  );

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const delta = e.clientX - d.startX;
      const newLeft = Math.max(200, Math.min(d.containerWidth * 0.4, d.startLeft + delta));
      setLeftWidth(newLeft);
    };

    const onMouseUp = () => {
      if (dragRef.current) {
        dragRef.current = null;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  const activeVersion = versions.find((v) => v.id === activeVersionId) ?? null;
  // During streaming show the live-compiled spec, otherwise show the version's final spec
  const displaySpec = isStreaming ? liveSpec : (activeVersion?.spec ?? null);

  const handleSend = useCallback(async (prompt: string) => {
    const id = `v${versions.length + 1}`;
    const version: Version = { id, prompt, spec: null, timestamp: Date.now() };

    const latestSpec = latestSpecRef.current;

    setVersions((prev) => [...prev, version]);
    setActiveVersionId(id);
    setIsStreaming(true);
    setLiveSpec(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          ...(latestSpec ? { currentSpec: latestSpec } : {}),
        }),
        signal: controller.signal,
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No reader');

      const decoder = new TextDecoder();
      const compiler = createSpecStreamCompiler();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        accumulated += chunk;
        // Feed chunk to the SpecStream compiler (strip fences so compiler only sees JSONL)
        try {
          const { result } = compiler.push(stripCodeFences(chunk));
          if (result && Object.keys(result).length > 0) {
            setLiveSpec({ ...result });
          }
        } catch {
          // Partial chunk, compiler will handle on next push
        }
      }

      // Get final compiled spec
      const finalSpec = compiler.getResult();
      if (finalSpec && Object.keys(finalSpec).length > 0) {
        setVersions((prev) =>
          prev.map((v) => (v.id === id ? { ...v, spec: finalSpec } : v)),
        );
        setLiveSpec(finalSpec);
        latestSpecRef.current = finalSpec;
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.error('Generation error:', err);
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, [versions.length]);

  const handleAbort = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const handleAnnotationSubmit = useCallback(
    async (elementKey: string, instruction: string) => {
      if (!displaySpec) return;

      try {
        const res = await fetch('/api/refine', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ elementKey, instruction, currentSpec: displaySpec }),
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const { spec: patchedSpec } = await res.json();
        if (!patchedSpec) return;

        // Create new version with the patched spec
        const id = `v${versions.length + 1}`;
        const version: Version = {
          id,
          prompt: `[refine ${elementKey}] ${instruction}`,
          spec: patchedSpec,
          timestamp: Date.now(),
        };
        setVersions((prev) => [...prev, version]);
        setActiveVersionId(id);
        setLiveSpec(patchedSpec);
        latestSpecRef.current = patchedSpec;
      } catch (err) {
        console.error('Annotation refine error:', err);
      }
    },
    [displaySpec, versions.length],
  );

  return (
    <div className="h-dvh flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm">openpkg</span>
          <span className="text-[var(--muted-foreground)] text-sm">/</span>
          <span className="font-semibold text-sm">playground</span>
        </div>
        <div className="flex items-center gap-4 text-sm text-[var(--muted-foreground)]">
          <span>Playground</span>
        </div>
      </header>

      {/* 3-panel layout */}
      <div ref={containerRef} className="flex-1 flex overflow-hidden">
        {/* Left: versions/chat */}
        <div style={{ width: leftWidth, minWidth: 200 }} className="flex flex-col shrink-0">
          <VersionsPanel
            versions={versions}
            activeVersionId={activeVersionId}
            onSelectVersion={setActiveVersionId}
            onSend={handleSend}
            onAbort={handleAbort}
            isStreaming={isStreaming}
          />
        </div>

        {/* Drag handle */}
        <div
          onMouseDown={handleMouseDown}
          className="w-[5px] shrink-0 cursor-col-resize relative group"
        >
          <div className="absolute inset-y-0 left-[2px] w-px bg-[var(--border)] group-hover:bg-[var(--muted-foreground)] transition-colors" />
        </div>

        {/* Preview/code */}
        <div className="flex-1 flex flex-col min-w-0">
          <PreviewPanel spec={displaySpec} isStreaming={isStreaming} onAnnotationSubmit={handleAnnotationSubmit} />
        </div>
      </div>
    </div>
  );
}
