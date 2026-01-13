/**
 * Server-side render styled React components to static HTML.
 *
 * This renders Tailwind-styled components to static HTML without client-side JS.
 * Uses Shiki for syntax highlighting at build time.
 */

import type { OpenPkg, SpecExport } from '@openpkg-ts/spec';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { BundledLanguage, BundledTheme, Highlighter } from 'shiki';
import { createHighlighter } from 'shiki';
import { formatParameters, formatReturnType, formatSchema } from '../core/query';

export interface StyledHTMLOptions {
  /** Page title override */
  title?: string;
  /** Include inline styles */
  includeStyles?: boolean;
  /** Custom CSS to inject */
  customCSS?: string;
  /** Custom head content */
  headContent?: string;
  /** Export to render (single export mode) */
  export?: string;
  /** Shiki theme for syntax highlighting */
  theme?: BundledTheme;
}

// Singleton highlighter instance
let highlighterInstance: Highlighter | null = null;

async function getHighlighter(theme: BundledTheme = 'github-dark'): Promise<Highlighter> {
  if (!highlighterInstance) {
    highlighterInstance = await createHighlighter({
      themes: ['github-dark', 'github-light'],
      langs: ['typescript', 'javascript', 'tsx', 'jsx', 'json', 'bash', 'shell'],
    });
  }
  return highlighterInstance;
}

/**
 * Highlight code using Shiki.
 */
async function highlightCode(
  code: string,
  lang: BundledLanguage = 'typescript',
  theme: BundledTheme = 'github-dark'
): Promise<string> {
  const highlighter = await getHighlighter(theme);
  return highlighter.codeToHtml(code, {
    lang,
    theme,
  });
}

// Base CSS variables for standalone HTML
const baseCSSVariables = `
:root {
  /* Base colors - light mode */
  --background: #ffffff;
  --foreground: #0a0a0a;
  --card: #ffffff;
  --card-foreground: #0a0a0a;
  --muted: #f4f4f5;
  --muted-foreground: #71717a;
  --border: #e4e4e7;
  --primary: #18181b;
  --primary-foreground: #fafafa;
  --secondary: #f4f4f5;
  --secondary-foreground: #18181b;
  --accent: #f4f4f5;
  --accent-foreground: #18181b;
  --radius: 0.5rem;

  /* Kind badge colors */
  --kind-function: #7c3aed;
  --kind-class: #2563eb;
  --kind-interface: #0891b2;
  --kind-type: #0d9488;
  --kind-enum: #d97706;
  --kind-variable: #57534e;
}

@media (prefers-color-scheme: dark) {
  :root {
    --background: #09090b;
    --foreground: #fafafa;
    --card: #18181b;
    --card-foreground: #fafafa;
    --muted: #27272a;
    --muted-foreground: #a1a1aa;
    --border: #27272a;
    --primary: #fafafa;
    --primary-foreground: #18181b;
    --secondary: #27272a;
    --secondary-foreground: #fafafa;
    --accent: #27272a;
    --accent-foreground: #fafafa;

    /* Kind badge colors - dark mode */
    --kind-function: #a78bfa;
    --kind-class: #60a5fa;
    --kind-interface: #22d3ee;
    --kind-type: #2dd4bf;
    --kind-enum: #fbbf24;
    --kind-variable: #a8a29e;
  }
}
`;

// Styled utility CSS
const baseUtilityCSS = `
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  line-height: 1.6;
  color: var(--foreground);
  background: var(--background);
}
a { color: var(--primary); text-decoration: none; }
a:hover { text-decoration: underline; }

/* Layout */
.container { max-width: 1100px; margin: 0 auto; padding: 2rem 1.5rem; }
.grid-2col { display: grid; grid-template-columns: 1fr; gap: 2rem; }
.grid-2col > * { min-width: 0; } /* Prevent grid children from overflowing */
@media (min-width: 1024px) {
  .grid-2col { grid-template-columns: 1fr 380px; }
}

/* Typography */
h1 { font-size: 2rem; font-weight: 700; margin-bottom: 0.5rem; }
h2 { font-size: 1.5rem; font-weight: 600; margin: 2rem 0 1rem; color: var(--foreground); }
h3 { font-size: 1.125rem; font-weight: 600; margin: 1.5rem 0 0.75rem; }
h4 { font-size: 1rem; font-weight: 600; margin: 1rem 0 0.5rem; }
p { margin-bottom: 1rem; color: var(--muted-foreground); }
.text-sm { font-size: 0.875rem; }
.text-muted { color: var(--muted-foreground); }
.font-mono { font-family: 'SF Mono', Monaco, 'Cascadia Code', Consolas, monospace; }

/* Code - Shiki overrides */
code {
  font-family: 'SF Mono', Monaco, 'Cascadia Code', Consolas, monospace;
  font-size: 0.875em;
  background: var(--muted);
  padding: 0.2em 0.4em;
  border-radius: 4px;
}
.shiki {
  padding: 1rem;
  border-radius: 8px;
  overflow-x: auto;
  margin: 0;
  font-size: 0.875rem;
}
.shiki code {
  background: none;
  padding: 0;
  font-size: inherit;
}

/* Cards */
.card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
}
.card-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
}
.card-title {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0;
}

/* Badges */
.badge {
  display: inline-block;
  padding: 0.125rem 0.5rem;
  font-size: 0.75rem;
  font-weight: 500;
  border-radius: 9999px;
  color: white;
}
.badge-function { background: var(--kind-function); }
.badge-class { background: var(--kind-class); }
.badge-interface { background: var(--kind-interface); }
.badge-type { background: var(--kind-type); }
.badge-enum { background: var(--kind-enum); }
.badge-variable { background: var(--kind-variable); }
.badge-required { background: #ef4444; font-size: 0.625rem; padding: 0.1rem 0.375rem; }
.badge-optional { background: var(--muted); color: var(--muted-foreground); font-size: 0.625rem; padding: 0.1rem 0.375rem; }
.badge-flag { background: var(--muted); color: var(--muted-foreground); font-size: 0.625rem; padding: 0.1rem 0.375rem; }
.badge-deprecated { background: #f59e0b; }
.badge-type-only { background: var(--kind-type); }
.badge-conditional { background: #8b5cf6; }
.badge-mapped { background: #06b6d4; }
.badge-template-literal { background: #10b981; }

/* Decorators */
.decorators { margin-bottom: 0.25rem; }
.decorator {
  font-family: 'SF Mono', Monaco, monospace;
  font-size: 0.75rem;
  color: var(--kind-function);
  background: none;
  padding: 0;
}
.mr-2 { margin-right: 0.5rem; }
.mb-1 { margin-bottom: 0.25rem; }
.mb-2 { margin-bottom: 0.5rem; }

/* Inherited badge */
.inherited-badge {
  font-size: 0.75rem;
  color: var(--muted-foreground);
  font-style: italic;
}

/* Throws section */
.throws-section {
  margin-top: 1rem;
  padding: 0.75rem;
  background: rgba(239, 68, 68, 0.1);
  border-left: 3px solid #ef4444;
  border-radius: 4px;
}
.throws-section h4 {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  color: #ef4444;
  margin-bottom: 0.5rem;
}
.throws-item { margin-bottom: 0.25rem; }
.throws-item code { font-size: 0.8125rem; }

/* Parameter list */
.param-list { margin-top: 1rem; }
.param-item {
  padding: 0.875rem 0;
  border-bottom: 1px solid var(--border);
}
.param-item:last-child { border-bottom: none; }
.param-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.param-name {
  font-family: 'SF Mono', Monaco, monospace;
  font-weight: 600;
  font-size: 0.9375rem;
}
.param-type {
  font-family: 'SF Mono', Monaco, monospace;
  font-size: 0.8125rem;
  color: var(--muted-foreground);
}
.param-desc {
  margin-top: 0.375rem;
  font-size: 0.875rem;
  color: var(--muted-foreground);
}

/* Section titles */
.section-title {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--muted-foreground);
  margin-bottom: 0.75rem;
}

/* Members table */
.members-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 0.5rem;
}
.members-table th,
.members-table td {
  text-align: left;
  padding: 0.75rem;
  border-bottom: 1px solid var(--border);
}
.members-table th {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--muted-foreground);
}

/* Code panel */
.code-panel {
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--border);
}
.code-panel-header {
  padding: 0.75rem 1rem;
  background: var(--muted);
  border-bottom: 1px solid var(--border);
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--muted-foreground);
}
.code-panel .shiki {
  border-radius: 0;
  margin: 0;
}

/* Sticky sidebar */
@media (min-width: 1024px) {
  .sticky-sidebar {
    position: sticky;
    top: 2rem;
    max-height: calc(100vh - 4rem);
    overflow-y: auto;
  }
}

/* Spacing */
.mt-1 { margin-top: 0.25rem; }
.mt-2 { margin-top: 0.5rem; }
.mt-4 { margin-top: 1rem; }
.mt-6 { margin-top: 1.5rem; }
.mb-2 { margin-bottom: 0.5rem; }
.mb-4 { margin-bottom: 1rem; }
.space-y-6 > * + * { margin-top: 1.5rem; }
`;

const KIND_ORDER = ['function', 'class', 'interface', 'type', 'enum', 'variable'] as const;
const KIND_LABELS: Record<string, string> = {
  function: 'Functions',
  class: 'Classes',
  interface: 'Interfaces',
  type: 'Types',
  enum: 'Enums',
  variable: 'Variables',
};

function escapeHTML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Pre-highlighted code map (populated before render)
type HighlightedCodeMap = Map<string, string>;

function KindBadge({ kind }: { kind: string }): ReactNode {
  return <span className={`badge badge-${kind}`}>{kind}</span>;
}

function ParameterList({ title, children }: { title: string; children: ReactNode }): ReactNode {
  return (
    <div className="param-list">
      <div className="section-title">{title}</div>
      {children}
    </div>
  );
}

function ParameterItem({
  name,
  type,
  required,
  description,
  decorators,
  inheritedFrom,
  flags,
}: {
  name: string;
  type: string;
  required?: boolean;
  description?: string;
  decorators?: { name: string; argumentsText?: string[] }[];
  inheritedFrom?: string;
  flags?: { abstract?: boolean; readonly?: boolean; static?: boolean };
}): ReactNode {
  return (
    <div className="param-item">
      {decorators && decorators.length > 0 && (
        <div className="decorators mb-1">
          {decorators.map((d, i) => {
            const args = d.argumentsText?.length ? `(${d.argumentsText.join(', ')})` : '';
            return (
              <code key={i} className="decorator mr-2">
                @{d.name}{args}
              </code>
            );
          })}
        </div>
      )}
      <div className="param-header">
        <span className="param-name">{name}</span>
        <span className="param-type">{type}</span>
        {required ? (
          <span className="badge badge-required">required</span>
        ) : (
          <span className="badge badge-optional">optional</span>
        )}
        {flags?.abstract && <span className="badge badge-flag">abstract</span>}
        {flags?.readonly && <span className="badge badge-flag">readonly</span>}
        {flags?.static && <span className="badge badge-flag">static</span>}
      </div>
      {inheritedFrom && (
        <div className="inherited-badge text-sm text-muted mt-1">
          Inherited from <code>{inheritedFrom}</code>
        </div>
      )}
      {description && <div className="param-desc">{description}</div>}
    </div>
  );
}

function HighlightedCode({ html }: { html: string }): ReactNode {
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}

function buildImport(exp: SpecExport, spec: OpenPkg): string {
  const pkgName = spec.meta.name || 'package';
  return `import { ${exp.name} } from '${pkgName}'`;
}

function FunctionCard({
  exp,
  spec,
  highlightedCode,
}: {
  exp: SpecExport;
  spec: OpenPkg;
  highlightedCode: HighlightedCodeMap;
}): ReactNode {
  const sig = exp.signatures?.[0];
  const params = sig?.parameters || [];
  const importStmt = buildImport(exp, spec);
  const codeKey = `${exp.id || exp.name}-example`;

  return (
    <div className="card" id={exp.id || exp.name}>
      <div className="grid-2col">
        <div>
          <div className="card-header">
            <KindBadge kind="function" />
            <h3 className="card-title">{exp.name}()</h3>
            {exp.deprecated && <span className="badge badge-deprecated">deprecated</span>}
            {(exp.flags as Record<string, boolean> | undefined)?.abstract && <span className="badge badge-flag">abstract</span>}
            {(exp.flags as Record<string, boolean> | undefined)?.typeOnly && <span className="badge badge-type-only">type-only</span>}
          </div>

          {exp.decorators && exp.decorators.length > 0 && (
            <div className="decorators mb-2">
              {exp.decorators.map((d, i) => {
                const args = d.argumentsText?.length ? `(${d.argumentsText.join(', ')})` : '';
                return (
                  <code key={i} className="decorator mr-2">
                    @{d.name}{args}
                  </code>
                );
              })}
            </div>
          )}

          {exp.description && <p>{exp.description}</p>}

          <code className="text-sm">{importStmt}</code>

          {params.length > 0 && (
            <ParameterList title="Parameters">
              {params.map((p, i) => (
                <ParameterItem
                  key={p.name || i}
                  name={p.name}
                  type={formatSchema(p.schema)}
                  required={p.required !== false}
                  description={p.description}
                />
              ))}
            </ParameterList>
          )}

          {sig?.returns && (
            <div className="mt-4">
              <div className="section-title">Returns</div>
              <div className="param-header">
                <span className="param-type">{formatSchema(sig.returns.schema)}</span>
              </div>
              {sig.returns.description && (
                <div className="param-desc mt-1">{sig.returns.description}</div>
              )}
            </div>
          )}

          {sig?.throws && sig.throws.length > 0 && (
            <div className="throws-section">
              <h4>Throws</h4>
              {sig.throws.map((t, i) => (
                <div key={i} className="throws-item">
                  {t.type && <code>{t.type}</code>}
                  {t.type && t.description && ' — '}
                  {t.description && <span>{t.description}</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="sticky-sidebar">
          <div className="code-panel">
            <div className="code-panel-header">{exp.name}()</div>
            {highlightedCode.has(codeKey) ? (
              <HighlightedCode html={highlightedCode.get(codeKey)!} />
            ) : (
              <pre>
                <code>{`${importStmt}\n\n// Usage\nconst result = ${exp.name}(${params.map((p) => p.name).join(', ')})`}</code>
              </pre>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ClassCard({
  exp,
  spec,
  highlightedCode,
}: {
  exp: SpecExport;
  spec: OpenPkg;
  highlightedCode: HighlightedCodeMap;
}): ReactNode {
  const importStmt = buildImport(exp, spec);
  const properties = exp.members?.filter((m) => !m.signatures?.length) || [];
  const methods = exp.members?.filter((m) => m.signatures?.length) || [];
  const codeKey = `${exp.id || exp.name}-example`;

  return (
    <div className="card" id={exp.id || exp.name}>
      <div className="grid-2col">
        <div>
          <div className="card-header">
            <KindBadge kind="class" />
            <h3 className="card-title">{exp.name}</h3>
            {exp.deprecated && <span className="badge badge-deprecated">deprecated</span>}
            {(exp.flags as Record<string, boolean> | undefined)?.abstract && <span className="badge badge-flag">abstract</span>}
            {(exp.flags as Record<string, boolean> | undefined)?.typeOnly && <span className="badge badge-type-only">type-only</span>}
          </div>

          {exp.decorators && exp.decorators.length > 0 && (
            <div className="decorators mb-2">
              {exp.decorators.map((d, i) => {
                const args = d.argumentsText?.length ? `(${d.argumentsText.join(', ')})` : '';
                return (
                  <code key={i} className="decorator mr-2">
                    @{d.name}{args}
                  </code>
                );
              })}
            </div>
          )}

          {exp.description && <p>{exp.description}</p>}
          <code className="text-sm">{importStmt}</code>

          {properties.length > 0 && (
            <ParameterList title="Properties">
              {properties.map((p, i) => {
                const flags = p.flags as Record<string, boolean> | undefined;
                return (
                  <ParameterItem
                    key={p.name || i}
                    name={p.name || ''}
                    type={formatSchema(p.schema)}
                    description={p.description}
                    decorators={p.decorators}
                    inheritedFrom={'inheritedFrom' in p ? (p.inheritedFrom as string) : undefined}
                    flags={flags ? { abstract: flags.abstract, readonly: flags.readonly, static: flags.static } : undefined}
                  />
                );
              })}
            </ParameterList>
          )}

          {methods.length > 0 && (
            <ParameterList title="Methods">
              {methods.map((m, i) => {
                const sig = m.signatures?.[0];
                const flags = m.flags as Record<string, boolean> | undefined;
                return (
                  <ParameterItem
                    key={m.name || i}
                    name={`${m.name}()`}
                    type={`${formatParameters(sig)}: ${formatReturnType(sig)}`}
                    description={m.description}
                    decorators={m.decorators}
                    inheritedFrom={'inheritedFrom' in m ? (m.inheritedFrom as string) : undefined}
                    flags={flags ? { abstract: flags.abstract, readonly: flags.readonly, static: flags.static } : undefined}
                  />
                );
              })}
            </ParameterList>
          )}
        </div>

        <div className="sticky-sidebar">
          <div className="code-panel">
            <div className="code-panel-header">{exp.name}</div>
            {highlightedCode.has(codeKey) ? (
              <HighlightedCode html={highlightedCode.get(codeKey)!} />
            ) : (
              <pre>
                <code>{`${importStmt}\n\nconst instance = new ${exp.name}()`}</code>
              </pre>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function InterfaceCard({
  exp,
  spec,
  highlightedCode,
}: {
  exp: SpecExport;
  spec: OpenPkg;
  highlightedCode: HighlightedCodeMap;
}): ReactNode {
  const importStmt = buildImport(exp, spec);
  const properties = exp.members?.filter((m) => !m.signatures?.length) || [];
  const codeKey = `${exp.id || exp.name}-example`;

  return (
    <div className="card" id={exp.id || exp.name}>
      <div className="grid-2col">
        <div>
          <div className="card-header">
            <KindBadge kind={exp.kind === 'type' ? 'type' : 'interface'} />
            <h3 className="card-title">{exp.name}</h3>
            {exp.deprecated && <span className="badge badge-deprecated">deprecated</span>}
            {(exp.flags as Record<string, boolean> | undefined)?.abstract && <span className="badge badge-flag">abstract</span>}
            {(exp.flags as Record<string, boolean> | undefined)?.typeOnly && <span className="badge badge-type-only">type-only</span>}
            {'typeAliasKind' in exp && exp.typeAliasKind === 'conditional' && <span className="badge badge-conditional">conditional</span>}
            {'typeAliasKind' in exp && exp.typeAliasKind === 'mapped' && <span className="badge badge-mapped">mapped</span>}
            {'typeAliasKind' in exp && exp.typeAliasKind === 'template-literal' && <span className="badge badge-template-literal">template literal</span>}
          </div>

          {exp.decorators && exp.decorators.length > 0 && (
            <div className="decorators mb-2">
              {exp.decorators.map((d, i) => {
                const args = d.argumentsText?.length ? `(${d.argumentsText.join(', ')})` : '';
                return (
                  <code key={i} className="decorator mr-2">
                    @{d.name}{args}
                  </code>
                );
              })}
            </div>
          )}

          {exp.description && <p>{exp.description}</p>}
          <code className="text-sm">{importStmt}</code>

          {properties.length > 0 && (
            <ParameterList title="Properties">
              {properties.map((p, i) => {
                const flags = p.flags as Record<string, boolean> | undefined;
                return (
                  <ParameterItem
                    key={p.name || i}
                    name={p.name || ''}
                    type={formatSchema(p.schema)}
                    description={p.description}
                    decorators={p.decorators}
                    flags={flags ? { abstract: flags.abstract, readonly: flags.readonly, static: flags.static } : undefined}
                  />
                );
              })}
            </ParameterList>
          )}
        </div>

        <div className="sticky-sidebar">
          <div className="code-panel">
            <div className="code-panel-header">{exp.name}</div>
            {highlightedCode.has(codeKey) ? (
              <HighlightedCode html={highlightedCode.get(codeKey)!} />
            ) : (
              <pre>
                <code>{`${importStmt}\n\nconst obj: ${exp.name} = {\n  // ...\n}`}</code>
              </pre>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function EnumCard({
  exp,
  spec,
  highlightedCode,
}: {
  exp: SpecExport;
  spec: OpenPkg;
  highlightedCode: HighlightedCodeMap;
}): ReactNode {
  const importStmt = buildImport(exp, spec);
  const codeKey = `${exp.id || exp.name}-example`;

  return (
    <div className="card" id={exp.id || exp.name}>
      <div className="grid-2col">
        <div>
          <div className="card-header">
            <KindBadge kind="enum" />
            <h3 className="card-title">{exp.name}</h3>
          </div>

          {exp.description && <p>{exp.description}</p>}
          <code className="text-sm">{importStmt}</code>

          {exp.members && exp.members.length > 0 && (
            <div className="mt-4">
              <div className="section-title">Members</div>
              <table className="members-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {exp.members.map((m, i) => (
                    <tr key={m.name || i}>
                      <td>
                        <code>{m.name}</code>
                      </td>
                      <td className="text-sm text-muted">{m.description || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="sticky-sidebar">
          <div className="code-panel">
            <div className="code-panel-header">{exp.name}</div>
            {highlightedCode.has(codeKey) ? (
              <HighlightedCode html={highlightedCode.get(codeKey)!} />
            ) : (
              <pre>
                <code>{`${importStmt}\n\nconst value = ${exp.name}.${exp.members?.[0]?.name || 'Value'}`}</code>
              </pre>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function VariableCard({
  exp,
  spec,
  highlightedCode,
}: {
  exp: SpecExport;
  spec: OpenPkg;
  highlightedCode: HighlightedCodeMap;
}): ReactNode {
  const importStmt = buildImport(exp, spec);
  const typeStr = typeof exp.type === 'string' ? exp.type : formatSchema(exp.schema);
  const codeKey = `${exp.id || exp.name}-example`;

  return (
    <div className="card" id={exp.id || exp.name}>
      <div className="grid-2col">
        <div>
          <div className="card-header">
            <KindBadge kind="variable" />
            <h3 className="card-title">{exp.name}</h3>
          </div>

          {exp.description && <p>{exp.description}</p>}
          <code className="text-sm">{importStmt}</code>

          <div className="mt-4">
            <div className="section-title">Type</div>
            <div className="param-type">{typeStr}</div>
          </div>
        </div>

        <div className="sticky-sidebar">
          <div className="code-panel">
            <div className="code-panel-header">{exp.name}</div>
            {highlightedCode.has(codeKey) ? (
              <HighlightedCode html={highlightedCode.get(codeKey)!} />
            ) : (
              <pre>
                <code>{`${importStmt}\n\nconsole.log(${exp.name})`}</code>
              </pre>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ExportCard({
  exp,
  spec,
  highlightedCode,
}: {
  exp: SpecExport;
  spec: OpenPkg;
  highlightedCode: HighlightedCodeMap;
}): ReactNode {
  const props = { exp, spec, highlightedCode };
  switch (exp.kind) {
    case 'function':
      return <FunctionCard {...props} />;
    case 'class':
      return <ClassCard {...props} />;
    case 'interface':
    case 'type':
      return <InterfaceCard {...props} />;
    case 'enum':
      return <EnumCard {...props} />;
    default:
      return <VariableCard {...props} />;
  }
}

function StaticAPIReference({
  spec,
  highlightedCode,
}: {
  spec: OpenPkg;
  highlightedCode: HighlightedCodeMap;
}): ReactNode {
  const grouped = new Map<string, SpecExport[]>();
  for (const exp of spec.exports) {
    const kind = exp.kind;
    if (!grouped.has(kind)) grouped.set(kind, []);
    grouped.get(kind)!.push(exp);
  }

  return (
    <div className="container">
      <header className="mb-4">
        <h1>{spec.meta.name} API Reference</h1>
        {spec.meta.description && <p>{spec.meta.description}</p>}
        {spec.meta.version && <p className="text-sm text-muted">Version {spec.meta.version}</p>}
      </header>

      {KIND_ORDER.map((kind) => {
        const exports = grouped.get(kind);
        if (!exports?.length) return null;

        return (
          <section key={kind}>
            <h2>{KIND_LABELS[kind]}</h2>
            <div className="space-y-6">
              {exports.map((exp) => (
                <ExportCard
                  key={exp.id || exp.name}
                  exp={exp}
                  spec={spec}
                  highlightedCode={highlightedCode}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function StaticExportPage({
  exp,
  spec,
  highlightedCode,
}: {
  exp: SpecExport;
  spec: OpenPkg;
  highlightedCode: HighlightedCodeMap;
}): ReactNode {
  return (
    <div className="container">
      <ExportCard exp={exp} spec={spec} highlightedCode={highlightedCode} />
    </div>
  );
}

/**
 * Generate example code for an export.
 */
function generateExampleCode(exp: SpecExport, spec: OpenPkg): string {
  const importStmt = buildImport(exp, spec);
  const sig = exp.signatures?.[0];
  const params = sig?.parameters || [];

  switch (exp.kind) {
    case 'function':
      return `${importStmt}\n\n// Usage\nconst result = ${exp.name}(${params.map((p) => p.name).join(', ')})`;
    case 'class':
      return `${importStmt}\n\nconst instance = new ${exp.name}()`;
    case 'interface':
    case 'type':
      return `${importStmt}\n\nconst obj: ${exp.name} = {\n  // ...\n}`;
    case 'enum':
      return `${importStmt}\n\nconst value = ${exp.name}.${exp.members?.[0]?.name || 'Value'}`;
    default:
      return `${importStmt}\n\nconsole.log(${exp.name})`;
  }
}

/**
 * Pre-highlight all code examples.
 */
async function preHighlightExports(
  exports: SpecExport[],
  spec: OpenPkg,
  theme: BundledTheme
): Promise<HighlightedCodeMap> {
  const codeMap = new Map<string, string>();

  // Get highlighter once upfront to avoid race conditions
  const highlighter = await getHighlighter(theme);

  // Collect all code to highlight
  const codeEntries: { key: string; code: string }[] = [];
  for (const exp of exports) {
    const key = `${exp.id || exp.name}-example`;
    const code = generateExampleCode(exp, spec);
    codeEntries.push({ key, code });
  }

  // Highlight all synchronously with the pre-fetched highlighter
  for (const { key, code } of codeEntries) {
    const html = highlighter.codeToHtml(code, { lang: 'typescript', theme });
    codeMap.set(key, html);
  }

  return codeMap;
}

/**
 * Render spec to styled HTML using React SSR with Shiki syntax highlighting.
 */
export async function toStyledHTML(spec: OpenPkg, options: StyledHTMLOptions = {}): Promise<string> {
  const { includeStyles = true, theme = 'github-dark' } = options;

  // Determine which exports to render
  const exportsToRender = options.export
    ? spec.exports.filter((e) => e.name === options.export || e.id === options.export)
    : spec.exports;

  if (options.export && exportsToRender.length === 0) {
    throw new Error(`Export not found: ${options.export}`);
  }

  // Pre-highlight all code
  const highlightedCode = await preHighlightExports(exportsToRender, spec, theme);

  let content: string;
  let title: string;

  if (options.export) {
    const exp = exportsToRender[0];
    content = renderToStaticMarkup(
      <StaticExportPage exp={exp} spec={spec} highlightedCode={highlightedCode} />
    );
    title = options.title || `${exp.name} | ${spec.meta.name}`;
  } else {
    content = renderToStaticMarkup(
      <StaticAPIReference spec={spec} highlightedCode={highlightedCode} />
    );
    title = options.title || `${spec.meta.name} API Reference`;
  }

  const styles = includeStyles
    ? `<style>${baseCSSVariables}${baseUtilityCSS}${options.customCSS || ''}</style>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHTML(title)}</title>
  <meta name="description" content="${escapeHTML(spec.meta.description || '')}">
  ${styles}
  ${options.headContent || ''}
</head>
<body>
  ${content}
</body>
</html>`;
}
