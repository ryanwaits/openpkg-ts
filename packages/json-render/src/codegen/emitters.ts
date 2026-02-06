import { serializePropValue } from '@json-render/codegen';
import type { UIElement } from '@json-render/core';
import type { PreparedExport, PreparedSpecData } from '../types';
import type { DataStrategy } from './types';

interface EmitterContext {
  data: PreparedSpecData;
  dataStrategy: DataStrategy;
  indent: string;
  childrenJsx: string;
}

type Emitter = (
  element: UIElement,
  ctx: EmitterContext,
) => string;

/** Serialize a value for inline embedding */
function sv(value: unknown): string {
  const { value: v, needsBraces } = serializePropValue(value);
  return needsBraces ? `{${v}}` : v;
}

/** Wrap JSX value in braces */
function jb(expr: string): string {
  return `{${expr}}`;
}

/** Reference to a data export variable: `data.exports["id"]` or inline literal */
function exportRef(exportId: string, field: string, exp: PreparedExport, strategy: DataStrategy): string {
  if (strategy === 'inline') {
    const val = exp[field as keyof PreparedExport];
    return sv(val);
  }
  return jb(`specData.exports["${exportId}"].${field}`);
}

/** Reference to top-level data field */
function dataRef(field: string, data: PreparedSpecData, strategy: DataStrategy): string {
  if (strategy === 'inline') {
    const val = data[field as keyof PreparedSpecData];
    return sv(val);
  }
  return jb(`specData.${field}`);
}

// ─── APIReferencePage ────────────────────────────────────────

const emitAPIReferencePage: Emitter = (element, ctx) => {
  const { title, description, theme } = element.props as {
    title?: string;
    description?: string | null;
    theme?: string | null;
  };
  const i = ctx.indent;

  const attrs: string[] = [];
  if (title) attrs.push(`title=${sv(title)}`);
  if (description) attrs.push(`description=${sv(description)}`);
  if (theme && theme !== 'default') attrs.push(`theme=${sv(theme)}`);

  return [
    `${i}<APIReferencePage${attrs.length ? ` ${attrs.join(' ')}` : ''}>`,
    ctx.childrenJsx,
    `${i}</APIReferencePage>`,
  ].join('\n');
};

// ─── APISection ──────────────────────────────────────────────

const emitAPISection: Emitter = (element, ctx) => {
  const { exportId, codePanelTitle } = element.props as {
    exportId: string;
    codePanelTitle?: string | null;
  };
  const exp = ctx.data.exports[exportId];
  if (!exp) return `${ctx.indent}{/* unknown export: ${exportId} */}`;

  const i = ctx.indent;
  const i2 = `${i}  `;
  const i3 = `${i2}  `;

  const attrs: string[] = [];
  attrs.push(`title=${exportRef(exportId, 'title', exp, ctx.dataStrategy)}`);
  attrs.push(`id=${exportRef(exportId, 'id', exp, ctx.dataStrategy)}`);
  if (exp.description) attrs.push(`description=${exportRef(exportId, 'description', exp, ctx.dataStrategy)}`);
  attrs.push(`examples=${exportRef(exportId, 'examples', exp, ctx.dataStrategy)}`);
  if (codePanelTitle) attrs.push(`codePanelTitle=${sv(codePanelTitle)}`);

  const parameterJsx = emitParameterMap(exportId, exp, ctx.dataStrategy, i3);

  const lines = [
    `${i}<APISection`,
    ...attrs.map((a) => `${i2}${a}`),
    `${i}>`,
    `${i2}<ParameterList title="Parameters">`,
    parameterJsx,
    `${i2}</ParameterList>`,
  ];

  if (ctx.childrenJsx.trim()) {
    lines.push(ctx.childrenJsx);
  }

  lines.push(`${i}</APISection>`);
  return lines.join('\n');
};

// ─── APISectionSingle ────────────────────────────────────────

const emitAPISectionSingle: Emitter = (element, ctx) => {
  const { exportId } = element.props as { exportId: string };
  const exp = ctx.data.exports[exportId];
  if (!exp) return `${ctx.indent}{/* unknown export: ${exportId} */}`;

  const i = ctx.indent;
  const i2 = `${i}  `;

  if (ctx.dataStrategy === 'inline') {
    return emitAPISectionSingleInline(exp, ctx.data, i);
  }

  const ref = `specData.exports["${exportId}"]`;
  const lines = [
    `${i}<APISectionSingle`,
    `${i2}title={${ref}.title}`,
    `${i2}id={${ref}.id}`,
    exp.description ? `${i2}description={${ref}.description}` : null,
    `${i2}example={{`,
    `${i2}  code: ${ref}.examples[0]?.code ?? ${ref}.signature,`,
    `${i2}  lang: ${ref}.examples[0]?.language ?? "typescript",`,
    `${i2}}}`,
    exp.parameters.length > 0
      ? `${i2}parameters={${emitParameterFragment(exportId, exp, 'file', i2)}}`
      : null,
    exp.returnTypeString
      ? `${i2}returns={${ref}.returnTypeString ? { type: ${ref}.returnTypeString, description: ${ref}.returnDescription } : undefined}`
      : null,
    `${i}/>`,
  ];

  return lines.filter(Boolean).join('\n');
};

function emitAPISectionSingleInline(exp: PreparedExport, data: PreparedSpecData, i: string): string {
  const i2 = `${i}  `;

  const firstExample = exp.examples[0];
  const exampleCode = firstExample?.code ?? exp.signature;
  const exampleLang = firstExample?.language ?? 'typescript';

  const lines = [
    `${i}<APISectionSingle`,
    `${i2}title=${sv(exp.title)}`,
    `${i2}id=${sv(exp.id)}`,
    exp.description ? `${i2}description=${sv(exp.description)}` : null,
    `${i2}example={{ code: ${sv(exampleCode).replace(/^"|"$/g, '')}, lang: ${sv(exampleLang).replace(/^"|"$/g, '')} }}`,
  ];

  if (exp.parameters.length > 0) {
    lines.push(
      `${i2}parameters={`,
      `${i2}  <>`,
    );
    for (const param of exp.parameters) {
      lines.push(`${i2}    <ExpandableParameter key=${sv(param.name)} parameter={${serializePropValue(param).value}} />`);
    }
    lines.push(
      `${i2}  </>`,
      `${i2}}`,
    );
  }

  if (exp.returnTypeString) {
    lines.push(
      `${i2}returns={{ type: ${sv(exp.returnTypeString).replace(/^"|"$/g, '')}, description: ${exp.returnDescription ? sv(exp.returnDescription).replace(/^"|"$/g, '') : 'undefined'} }}`,
    );
  }

  lines.push(`${i}/>`);
  return lines.filter(Boolean).join('\n');
}

// ─── ExportSection (resolved statically) ─────────────────────

const emitExportSection: Emitter = (element, ctx) => {
  const { exportId } = element.props as { exportId: string };
  const exp = ctx.data.exports[exportId];
  if (!exp) return `${ctx.indent}{/* unknown export: ${exportId} */}`;

  // Resolve at codegen time — never appears in output
  if (exp.kind === 'function') {
    return emitAPISection(element, ctx);
  }
  return emitAPISectionSingle(element, ctx);
};

// ─── ParameterList ───────────────────────────────────────────

const emitParameterList: Emitter = (element, ctx) => {
  const { exportId, title, collapseAfter } = element.props as {
    exportId: string;
    title?: string | null;
    collapseAfter?: number | null;
  };
  const exp = ctx.data.exports[exportId];
  if (!exp || exp.parameters.length === 0) return '';

  const i = ctx.indent;
  const i2 = `${i}  `;

  const attrs: string[] = [];
  attrs.push(`title=${sv(title ?? 'Parameters')}`);
  if (collapseAfter) attrs.push(`collapseAfter={${collapseAfter}}`);

  return [
    `${i}<ParameterList ${attrs.join(' ')}>`,
    emitParameterMap(exportId, exp, ctx.dataStrategy, i2),
    `${i}</ParameterList>`,
  ].join('\n');
};

// ─── ResponseBlock ───────────────────────────────────────────

const emitResponseBlock: Emitter = (element, ctx) => {
  const { exportId } = element.props as { exportId: string };
  const exp = ctx.data.exports[exportId];
  if (!exp || !exp.returnTypeString) return '';

  const i = ctx.indent;

  if (ctx.dataStrategy === 'inline') {
    return [
      `${i}<div className="returns-section">`,
      `${i}  <h3 className="text-xs font-medium tracking-wider text-muted-foreground uppercase font-mono mb-4">Returns</h3>`,
      `${i}  <code className="text-sm font-mono text-foreground bg-muted px-2 py-1 rounded">${exp.returnTypeString}</code>`,
      exp.returnDescription
        ? `${i}  <div className="mt-2 text-sm text-muted-foreground">${exp.returnDescription}</div>`
        : null,
      `${i}</div>`,
    ].filter(Boolean).join('\n');
  }

  const ref = `specData.exports["${exportId}"]`;
  return [
    `${i}<div className="returns-section">`,
    `${i}  <h3 className="text-xs font-medium tracking-wider text-muted-foreground uppercase font-mono mb-4">Returns</h3>`,
    `${i}  <code className="text-sm font-mono text-foreground bg-muted px-2 py-1 rounded">{${ref}.returnTypeString}</code>`,
    `${i}  {${ref}.returnDescription && (`,
    `${i}    <div className="mt-2 text-sm text-muted-foreground">{${ref}.returnDescription}</div>`,
    `${i}  )}`,
    `${i}</div>`,
  ].join('\n');
};

// ─── ExportIndexPage ─────────────────────────────────────────

const emitExportIndexPage: Emitter = (_element, ctx) => {
  // This is a standalone client component with useState — we return a marker
  // that the generator will replace with a separate file import
  return `${ctx.indent}<ExportIndexPage />`;
};

// ─── Helpers ─────────────────────────────────────────────────

function emitParameterMap(
  exportId: string,
  exp: PreparedExport,
  strategy: DataStrategy,
  indent: string,
): string {
  if (strategy === 'inline') {
    return exp.parameters
      .map((p) => `${indent}<ExpandableParameter key=${sv(p.name)} parameter={${serializePropValue(p).value}} />`)
      .join('\n');
  }
  return [
    `${indent}{specData.exports["${exportId}"].parameters.map((param) => (`,
    `${indent}  <ExpandableParameter key={param.name} parameter={param} />`,
    `${indent}))}`,
  ].join('\n');
}

function emitParameterFragment(
  exportId: string,
  exp: PreparedExport,
  strategy: DataStrategy,
  indent: string,
): string {
  if (strategy === 'inline') {
    const lines = ['<>'];
    for (const p of exp.parameters) {
      lines.push(`${indent}  <ExpandableParameter key=${sv(p.name)} parameter={${serializePropValue(p).value}} />`);
    }
    lines.push(`${indent}</>`);
    return lines.join('\n');
  }
  return [
    `<>`,
    `${indent}  {specData.exports["${exportId}"].parameters.map((param) => (`,
    `${indent}    <ExpandableParameter key={param.name} parameter={param} />`,
    `${indent}  ))}`,
    `${indent}</>`,
  ].join('\n');
}

// ─── Section ─────────────────────────────────────────────────

const emitSection: Emitter = (element, ctx) => {
  const { exportId, title, description, withHover } = element.props as {
    exportId?: string | null;
    title?: string | null;
    description?: string | null;
    withHover?: boolean | null;
  };
  const exp = exportId ? ctx.data.exports[exportId] : null;

  const i = ctx.indent;
  const resolvedTitle = title ?? exp?.title;
  const resolvedDescription = description ?? exp?.description;
  const sectionId = exp?.id;

  const lines: string[] = [];

  if (withHover) {
    lines.push(`${i}<WithHover>`);
  }

  const idAttr = sectionId ? ` id=${sv(sectionId)}` : '';
  lines.push(`${i}${withHover ? '  ' : ''}<section${idAttr} className="border-b border-border py-8">`);
  const inner = withHover ? `${i}    ` : `${i}  `;
  if (resolvedTitle) lines.push(`${inner}<h2 className="text-xl font-semibold mb-2">${resolvedTitle}</h2>`);
  if (resolvedDescription) lines.push(`${inner}<p className="text-sm text-muted-foreground mb-4">${resolvedDescription}</p>`);
  if (ctx.childrenJsx.trim()) lines.push(ctx.childrenJsx);
  lines.push(`${i}${withHover ? '  ' : ''}</section>`);

  if (withHover) {
    lines.push(`${i}</WithHover>`);
  }

  return lines.join('\n');
};

// ─── InstallBlock ────────────────────────────────────────────

const emitInstallBlock: Emitter = (_element, ctx) => {
  const i = ctx.indent;

  if (ctx.dataStrategy === 'inline') {
    return `${i}<PackageInstall package=${sv(ctx.data.packageName)} />`;
  }
  return `${i}<PackageInstall package={specData.packageName} />`;
};

// ─── CodeBlock ───────────────────────────────────────────────

const emitCodeBlock: Emitter = (element, ctx) => {
  const { exportId, lang, title, flags } = element.props as {
    exportId: string;
    lang?: string | null;
    title?: string | null;
    flags?: string | null;
  };
  const exp = ctx.data.exports[exportId];
  if (!exp) return `${ctx.indent}{/* unknown export: ${exportId} */}`;

  const i = ctx.indent;
  const firstExample = exp.examples[0];
  const code = firstExample?.code ?? exp.signature;
  const resolvedLang = lang ?? firstExample?.language ?? 'typescript';
  const showLineNumbers = flags?.includes('n') ?? false;

  if (ctx.dataStrategy === 'inline') {
    return [
      `${i}<CodeBlock`,
      `${i}  code={${sv(code)}}`,
      `${i}  language=${sv(resolvedLang)}`,
      showLineNumbers ? `${i}  showLineNumbers` : null,
      `${i}/>`,
    ].filter(Boolean).join('\n');
  }

  const ref = `specData.exports["${exportId}"]`;
  return [
    `${i}<CodeBlock`,
    `${i}  code={${ref}.examples[0]?.code ?? ${ref}.signature}`,
    `${i}  language=${sv(resolvedLang)}`,
    showLineNumbers ? `${i}  showLineNumbers` : null,
    `${i}/>`,
  ].filter(Boolean).join('\n');
};

// ─── Registry ────────────────────────────────────────────────

export const emitters: Record<string, Emitter> = {
  APIReferencePage: emitAPIReferencePage,
  APISection: emitAPISection,
  APISectionSingle: emitAPISectionSingle,
  CodeBlock: emitCodeBlock,
  ExportSection: emitExportSection,
  ExportIndexPage: emitExportIndexPage,
  InstallBlock: emitInstallBlock,
  ParameterList: emitParameterList,
  ResponseBlock: emitResponseBlock,
  Section: emitSection,
};
