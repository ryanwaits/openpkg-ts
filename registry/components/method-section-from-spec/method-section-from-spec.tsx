'use client';

import { type ReactNode, useRef, useState } from 'react';

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
// Types
// =============================================================================

interface NestedParam {
  name: string;
  type: string;
  description?: string;
  required?: boolean;
  enumValues?: string[];
  children?: NestedParam[];
}

// =============================================================================
// Props
// =============================================================================

export interface MethodSectionFromSpecProps {
  spec: OpenPkg;
  export: string | SpecExport;
  className?: string;
}

// =============================================================================
// Component
// =============================================================================

export function MethodSectionFromSpec({
  spec,
  export: exportProp,
  className,
}: MethodSectionFromSpecProps): ReactNode {
  const exp =
    typeof exportProp === 'string'
      ? spec.exports.find((e) => e.name === exportProp)
      : exportProp;

  if (!exp) return null;

  const sig = exp.signatures?.[0];
  const params = sig?.parameters ?? [];
  const notes = buildNotes(exp);

  // Build signature string
  const paramStr = params.map((p) => `${p.name}${p.required === false ? '?' : ''}`).join(', ');
  const signature = `${exp.name}(${paramStr})`;

  return (
    <section
      id={exp.id || exp.name}
      data-section={exp.id || exp.name}
      className={`openpkg-method-section mb-16 scroll-mt-8 ${className || ''}`}
    >
      {/* Title */}
      <h2 className="text-2xl font-semibold text-[#ededed] mb-3 flex items-center gap-3">
        {exp.name}
        <a
          href={`#${exp.id || exp.name}`}
          className="text-[#666666] hover:text-[#a0a0a0] opacity-0 hover:opacity-100 transition-opacity"
        >
          #
        </a>
      </h2>

      {/* Signature */}
      <div className="font-mono text-sm text-[#c4a7e7] bg-[#0f0f18] border border-[#262626] rounded-md px-4 py-2 mb-5 overflow-x-auto">
        {signature}
      </div>

      {/* Description */}
      {exp.description && (
        <p className="text-[15px] text-[#a0a0a0] leading-relaxed mb-6">{exp.description}</p>
      )}

      {/* Notes */}
      {notes.length > 0 && (
        <ul className="mb-6 space-y-1.5">
          {notes.map((note, i) => (
            <li key={i} className="text-[14px] text-[#a0a0a0] flex items-start gap-2">
              <span className="text-[#3ecf8e] mt-1">•</span>
              <span>{note}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Parameters header */}
      {params.length > 0 && (
        <>
          <h3 className="text-xs font-semibold text-[#666666] uppercase tracking-wider mb-4">
            Parameters
          </h3>
          <div className="space-y-0">
            {params.map((param) => (
              <ExpandableParam
                key={param.name}
                param={convertParam(param, spec)}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

// =============================================================================
// Helpers
// =============================================================================

function buildNotes(exp: SpecExport): string[] {
  const notes: string[] = [];
  if (exp.deprecated) {
    notes.push(exp.deprecationReason ? `⚠️ Deprecated: ${exp.deprecationReason}` : '⚠️ Deprecated');
  }
  const sig = exp.signatures?.[0];
  if (sig?.tags) {
    for (const tag of sig.tags) {
      if (tag.name === 'note' || tag.name === 'remarks') {
        notes.push(tag.text);
      }
    }
  }
  if (exp.flags?.async) {
    notes.push('This function is async and returns a Promise.');
  }
  return notes;
}

function convertParam(param: SpecSignatureParameter, spec: OpenPkg): NestedParam {
  const schema = param.schema ?? {};
  return {
    name: param.name,
    type: getTypeName(schema, spec),
    description: param.description,
    required: param.required !== false,
    enumValues: schema.enum,
    children: getChildren(schema, spec),
  };
}

function getTypeName(schema: SpecSchema, spec: OpenPkg): string {
  if (schema.$ref) {
    return schema.$ref.split('/').pop() || 'unknown';
  }
  if (schema.type === 'array' && schema.items) {
    return `${getTypeName(schema.items, spec)}[]`;
  }
  return schema.type || 'unknown';
}

function getChildren(schema: SpecSchema, spec: OpenPkg): NestedParam[] | undefined {
  let resolved = schema;
  if (schema.$ref && spec.schemas) {
    const refName = schema.$ref.split('/').pop();
    if (refName && spec.schemas[refName]) {
      resolved = spec.schemas[refName];
    }
  }
  if (resolved.type === 'object' && resolved.properties) {
    return Object.entries(resolved.properties).map(([name, propSchema]) => ({
      name,
      type: getTypeName(propSchema, spec),
      enumValues: propSchema.enum,
      children: getChildren(propSchema, spec),
    }));
  }
  return undefined;
}

// =============================================================================
// ExpandableParam (inline)
// =============================================================================

function ExpandableParam({ param }: { param: NestedParam }): ReactNode {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = param.children && param.children.length > 0;

  return (
    <div className="openpkg-expandable-param border-b border-[#262626] last:border-b-0">
      {/* Parameter row */}
      <div className="py-4 flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-[13px] text-[#ededed]">{param.name}</span>
            <span className="font-mono text-[12px] text-[#666666]">{param.type}</span>
            {param.required && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 bg-[#262626] text-[#a0a0a0] rounded">
                required
              </span>
            )}
          </div>
          {param.description && (
            <p className="text-[13px] text-[#a0a0a0] leading-relaxed">{param.description}</p>
          )}
          {param.enumValues && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {param.enumValues.map((v) => (
                <span
                  key={v}
                  className="font-mono text-[11px] px-2 py-0.5 bg-[#0f0f18] text-[#9ccfd8] border border-[#262626] rounded"
                >
                  {v}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Toggle */}
      {hasChildren && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 text-[12px] text-[#6cb6ff] hover:text-[#9ccfd8] cursor-pointer mb-2 ml-0"
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
      )}

      {/* Children */}
      {expanded && param.children && (
        <div className="ml-4 pl-4 border-l-2 border-[#262626] mb-4">
          {param.children.map((child) => (
            <ExpandableParam key={child.name} param={child} />
          ))}
        </div>
      )}
    </div>
  );
}
