'use client';

import { type ReactNode, useRef, useState } from 'react';

export interface CodeExample {
  id: string;
  label: string;
  code: string;
  language?: string;
}

export interface ExampleSectionProps {
  id: string;
  examples: CodeExample[];
  dataSource?: string;
  response?: string;
  notes?: ReactNode;
  isActive?: boolean;
  className?: string;
}

/**
 * Complete right-column section combining chips, code, and collapsible panels.
 */
export function ExampleSection({
  id,
  examples,
  dataSource,
  response,
  notes,
  isActive = true,
  className,
}: ExampleSectionProps): ReactNode {
  const [activeExampleId, setActiveExampleId] = useState(examples[0]?.id ?? '');
  const ref = useRef<HTMLDivElement>(null);

  const activeExample = examples.find((e) => e.id === activeExampleId) ?? examples[0];

  return (
    <div
      ref={ref}
      data-section={id}
      className={`openpkg-example-section mb-12 last:mb-0 transition-opacity duration-300 ${
        isActive ? 'opacity-100' : 'opacity-40'
      } ${className || ''}`}
    >
      {/* Example chips */}
      {examples.length > 1 && (
        <div className="openpkg-example-chips flex flex-wrap gap-2 mb-5">
          {examples.map((example) => (
            <button
              key={example.id}
              type="button"
              onClick={() => setActiveExampleId(example.id)}
              className={`text-xs font-medium px-3 py-1.5 border rounded-md cursor-pointer transition-all ${
                example.id === activeExampleId
                  ? 'border-[#666666] text-[#ededed] bg-[#1c1c1c]'
                  : 'border-[#333333] text-[#a0a0a0] hover:border-[#666666] hover:text-[#ededed]'
              }`}
            >
              {example.label}
            </button>
          ))}
        </div>
      )}

      {/* Main code panel */}
      {activeExample && (
        <CodePanelInline
          code={activeExample.code}
          language={activeExample.language ?? 'typescript'}
          showLineNumbers
        />
      )}

      {/* Collapsible panels */}
      {dataSource && (
        <CollapsibleInline title="Data source">
          <div className="p-4">
            <CodePanelInline code={dataSource} language="sql" />
          </div>
        </CollapsibleInline>
      )}

      {response && (
        <CollapsibleInline title="Response">
          <div className="p-4">
            <CodePanelInline code={response} language="json" />
          </div>
        </CollapsibleInline>
      )}

      {notes && (
        <CollapsibleInline title="Notes">
          <div className="p-4 text-[13px] text-[#a0a0a0] leading-relaxed">
            {typeof notes === 'string' ? <p>{notes}</p> : notes}
          </div>
        </CollapsibleInline>
      )}
    </div>
  );
}

// Inline code panel (simplified)
function CodePanelInline({ code, language, showLineNumbers }: { code: string; language: string; showLineNumbers?: boolean }) {
  const lines = code.split('\n');
  return (
    <div className="bg-[#0f0f18] border border-[#262626] rounded-lg overflow-hidden mb-3">
      <div className="p-5 overflow-x-auto">
        <pre className="font-mono text-[13px] leading-relaxed text-[#e4e4e7] m-0">
          {lines.map((line, i) => (
            <div key={i} className="flex">
              {showLineNumbers && (
                <span className="w-7 shrink-0 text-[#666666] text-right pr-5 select-none opacity-50">{i + 1}</span>
              )}
              <span className="flex-1">{line || '\u00A0'}</span>
            </div>
          ))}
        </pre>
      </div>
    </div>
  );
}

// Inline collapsible (simplified)
function CollapsibleInline({ title, children }: { title: string; children: ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className={`flex items-center gap-2.5 w-full px-4 py-3 bg-[#161616] border border-[#262626] cursor-pointer hover:bg-[#1c1c1c] ${
          expanded ? 'rounded-t-md border-b-transparent' : 'rounded-md mb-2'
        }`}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`text-[#666666] transition-transform ${expanded ? 'rotate-90' : ''}`}
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <span className="text-[13px] font-medium text-[#a0a0a0]">{title}</span>
      </button>
      {expanded && (
        <div className="bg-[#0f0f18] border border-[#262626] border-t-0 rounded-b-md mb-2">{children}</div>
      )}
    </div>
  );
}
