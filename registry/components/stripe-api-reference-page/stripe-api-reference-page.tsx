'use client';

import { type ReactNode, useRef, useState, createContext, useContext, useEffect } from 'react';

// =============================================================================
// Types (subset of @openpkg-ts/spec)
// =============================================================================

interface SpecSchema {
  type?: string;
  properties?: Record<string, SpecSchema>;
  items?: SpecSchema;
  enum?: string[];
  $ref?: string;
}

interface SpecExample {
  title?: string;
  description?: string;
  code: string;
  language?: string;
}

interface SpecSignatureParameter {
  name: string;
  description?: string;
  required?: boolean;
  schema?: SpecSchema;
}

interface SpecSignature {
  parameters?: SpecSignatureParameter[];
  returns?: { description?: string; schema?: SpecSchema };
  tags?: Array<{ name: string; text: string }>;
  examples?: SpecExample[];
}

interface SpecExport {
  id?: string;
  name: string;
  kind: string;
  description?: string;
  deprecated?: boolean;
  deprecationReason?: string;
  signatures?: SpecSignature[];
  flags?: Record<string, unknown>;
}

interface OpenPkg {
  meta: { name: string };
  exports: SpecExport[];
  schemas?: Record<string, SpecSchema>;
}

// =============================================================================
// Props
// =============================================================================

export interface StripeAPIReferencePageProps {
  spec: OpenPkg;
  filter?: (exp: SpecExport) => boolean;
  showAllKinds?: boolean;
  className?: string;
}

// =============================================================================
// Component
// =============================================================================

export function StripeAPIReferencePage({
  spec,
  filter,
  showAllKinds = false,
  className,
}: StripeAPIReferencePageProps): ReactNode {
  const defaultFilter = (exp: SpecExport) => (showAllKinds ? true : exp.kind === 'function');
  const activeFilter = filter ?? defaultFilter;
  const exports = spec.exports.filter(activeFilter).sort((a, b) => a.name.localeCompare(b.name));

  const [activeSection, setActiveSection] = useState(exports[0]?.id || exports[0]?.name || '');

  return (
    <ActiveSectionContext.Provider value={{ activeSection, setActiveSection }}>
      <div
        className={`openpkg-stripe-api-page bg-[#0c0c0c] text-[#ededed] min-h-screen ${className || ''}`}
      >
        <div className="max-w-[1600px] mx-auto flex flex-col lg:grid lg:grid-cols-[58%_42%]">
          {/* Left column - docs */}
          <div className="py-8 px-4 lg:py-12 lg:px-12 lg:pl-16 lg:border-r lg:border-[#262626]">
            {exports.map((exp) => (
              <MethodSection key={exp.id || exp.name} exp={exp} spec={spec} />
            ))}
          </div>

          {/* Right column - examples */}
          <div className="border-t border-[#262626] lg:border-t-0 py-8 px-4 lg:py-12 lg:px-12 lg:pl-8 lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto bg-[#0c0c0c]">
            {exports.map((exp) => (
              <ExampleSection key={exp.id || exp.name} exp={exp} spec={spec} />
            ))}
          </div>
        </div>
      </div>
    </ActiveSectionContext.Provider>
  );
}

// =============================================================================
// Context for active section
// =============================================================================

const ActiveSectionContext = createContext<{
  activeSection: string;
  setActiveSection: (id: string) => void;
}>({ activeSection: '', setActiveSection: () => {} });

// =============================================================================
// MethodSection (left column)
// =============================================================================

function MethodSection({ exp, spec }: { exp: SpecExport; spec: OpenPkg }): ReactNode {
  const sectionId = exp.id || exp.name;
  const ref = useRef<HTMLElement>(null);
  const { setActiveSection } = useContext(ActiveSectionContext);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setActiveSection(sectionId);
        }
      },
      { rootMargin: '-20% 0px -60% 0px' }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [sectionId, setActiveSection]);

  const sig = exp.signatures?.[0];
  const params = sig?.parameters ?? [];
  const paramStr = params.map((p) => `${p.name}${p.required === false ? '?' : ''}`).join(', ');

  return (
    <section ref={ref} id={sectionId} className="mb-16 scroll-mt-8">
      <h2 className="text-2xl font-semibold text-[#ededed] mb-3">{exp.name}</h2>
      <div className="font-mono text-sm text-[#c4a7e7] bg-[#0f0f18] border border-[#262626] rounded-md px-4 py-2 mb-5">
        {exp.name}({paramStr})
      </div>
      {exp.description && <p className="text-[15px] text-[#a0a0a0] mb-6">{exp.description}</p>}
      {params.length > 0 && (
        <>
          <h3 className="text-xs font-semibold text-[#666666] uppercase tracking-wider mb-4">
            Parameters
          </h3>
          {params.map((param) => (
            <ParamRow key={param.name} param={param} spec={spec} />
          ))}
        </>
      )}
    </section>
  );
}

// =============================================================================
// ParamRow
// =============================================================================

function ParamRow({ param, spec }: { param: SpecSignatureParameter; spec: OpenPkg }): ReactNode {
  const [expanded, setExpanded] = useState(false);
  const schema = param.schema ?? {};
  const children = getChildren(schema, spec);
  const hasChildren = children && children.length > 0;

  return (
    <div className="border-b border-[#262626] last:border-b-0">
      <div className="py-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-mono text-[13px] text-[#ededed]">{param.name}</span>
          <span className="font-mono text-[12px] text-[#666666]">{getTypeName(schema, spec)}</span>
          {param.required !== false && (
            <span className="text-[10px] px-1.5 py-0.5 bg-[#262626] text-[#a0a0a0] rounded">
              required
            </span>
          )}
        </div>
        {param.description && <p className="text-[13px] text-[#a0a0a0]">{param.description}</p>}
      </div>
      {hasChildren && (
        <>
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-2 text-[12px] text-[#6cb6ff] hover:text-[#9ccfd8] cursor-pointer mb-2"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className={`transition-transform ${expanded ? 'rotate-45' : ''}`}
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            {expanded ? 'Hide' : 'Show'} child parameters
          </button>
          {expanded && (
            <div className="ml-4 pl-4 border-l-2 border-[#262626] mb-4">
              {children.map((child) => (
                <div key={child.name} className="py-3 border-b border-[#262626] last:border-b-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-[13px] text-[#ededed]">{child.name}</span>
                    <span className="font-mono text-[12px] text-[#666666]">{child.type}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// =============================================================================
// ExampleSection (right column)
// =============================================================================

function ExampleSection({ exp, spec }: { exp: SpecExport; spec: OpenPkg }): ReactNode {
  const sectionId = exp.id || exp.name;
  const { activeSection } = useContext(ActiveSectionContext);
  const isActive = activeSection === sectionId;

  const sig = exp.signatures?.[0];
  const examples = sig?.examples ?? [];
  const params = sig?.parameters ?? [];

  // Generate default example if none provided
  const code =
    examples[0]?.code ||
    `import { ${exp.name} } from '${spec.meta.name}';\n\nconst result = await ${exp.name}(${params.map((p) => p.name).join(', ')});`;

  return (
    <div
      data-section={sectionId}
      className={`mb-12 last:mb-0 transition-opacity ${isActive ? 'opacity-100' : 'opacity-40'}`}
    >
      <div className="bg-[#0f0f18] border border-[#262626] rounded-lg overflow-hidden">
        <div className="p-5 overflow-x-auto">
          <pre className="font-mono text-[13px] text-[#e4e4e7] m-0 whitespace-pre">{code}</pre>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Helpers
// =============================================================================

function getTypeName(schema: SpecSchema, spec: OpenPkg): string {
  if (schema.$ref) return schema.$ref.split('/').pop() || 'unknown';
  if (schema.type === 'array' && schema.items) return `${getTypeName(schema.items, spec)}[]`;
  return schema.type || 'unknown';
}

function getChildren(
  schema: SpecSchema,
  spec: OpenPkg
): Array<{ name: string; type: string }> | undefined {
  let resolved = schema;
  if (schema.$ref && spec.schemas) {
    const refName = schema.$ref.split('/').pop();
    if (refName && spec.schemas[refName]) resolved = spec.schemas[refName];
  }
  if (resolved.type === 'object' && resolved.properties) {
    return Object.entries(resolved.properties).map(([name, propSchema]) => ({
      name,
      type: getTypeName(propSchema, spec),
    }));
  }
  return undefined;
}
