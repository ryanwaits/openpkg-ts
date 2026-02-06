import type { OpenPkg } from '@openpkg-ts/spec';
import { createOpenpkgCatalog } from '../catalog';
import { prepareSpecData } from './prepare-data';

interface CatalogLike {
  prompt: (opts?: { customRules?: string[] }) => string;
}

const CUSTOM_RULES = [
  'Always use APIReferencePage as the root element.',
  'Use ExportSection for automatic routing by export kind, or APISection/APISectionSingle for explicit control.',
  'Reference exports by their exportId string. Available exportIds are listed below.',
  'For two-column Stripe-style layout, use theme="default" and APISection components.',
  'For single-column layout, use theme="single" and APISectionSingle components.',
  'Group related exports together logically (e.g., all CRUD operations in sequence).',
  'IMPORTANT: APISection and APISectionSingle are self-contained — they already render parameters, code examples, and return types internally. NEVER add ParameterList, ResponseBlock, or CodeBlock as children of APISection/APISectionSingle/ExportSection. These child components are only for use inside Section containers.',
  'For custom layouts, use Section + CodeBlock/InstallBlock/ParameterList/ResponseBlock children in any order. Section is a flexible container; the child components control what appears inside it.',
  'CodeBlock props: title sets filename in code header, flags controls display (c=copy button, n=line numbers, w=word wrap, e.g. flags="cn"). Optional code prop overrides the default example code.',
  'APISection, APISectionSingle, and CodeBlock accept optional "code" and "codeLang" props to override the default code example from the export data. Use these to inject CodeHike annotations (// !mark, // !hover, // !diff, etc.) or customize code content.',
];

interface BuildSystemPromptOptions {
  currentSpec?: Record<string, unknown>;
}

/** Build a system prompt for AI-composed layout generation */
export function buildSystemPrompt(
  spec: OpenPkg,
  catalogOrOptions?: CatalogLike | BuildSystemPromptOptions,
  options?: BuildSystemPromptOptions,
): string {
  // Support both (spec, catalog, options) and (spec, options) signatures
  let catalog: CatalogLike | undefined;
  let opts: BuildSystemPromptOptions | undefined;
  if (catalogOrOptions && 'prompt' in catalogOrOptions) {
    catalog = catalogOrOptions;
    opts = options;
  } else {
    opts = catalogOrOptions as BuildSystemPromptOptions | undefined;
  }

  const data = prepareSpecData(spec);
  const cat = catalog ?? createOpenpkgCatalog();
  const componentDocs = cat.prompt({ customRules: CUSTOM_RULES });

  const exportList = data.allExportIds
    .map((id) => {
      const exp = data.exports[id];
      return `  - "${id}" (${exp.kind}): ${exp.title}${exp.description ? ` — ${exp.description}` : ''}`;
    })
    .join('\n');

  const kindSummary = Object.entries(data.exportsByKind)
    .map(([kind, exports]) => `  ${kind}: ${exports.length}`)
    .join('\n');

  let prompt = `${componentDocs}

## OpenPKG Context

Package: ${data.packageName}
${data.packageDescription ? `Description: ${data.packageDescription}` : ''}

### Available Exports
${exportList}

### Export Summary by Kind
${kindSummary}

### Layout Guidelines
- Use ExportSection when you want automatic rendering based on export kind
- Use APISection (two-column) for detailed Stripe-style reference docs
- Use APISectionSingle (single-column) for simpler, linear documentation
- Use ExportIndexPage for overview/landing pages
- APISection/APISectionSingle/ExportSection are SELF-CONTAINED — never nest ParameterList, ResponseBlock, or CodeBlock inside them (they already render those)
- For custom layouts, use Section as a flexible container with CodeBlock/InstallBlock/ParameterList/ResponseBlock as children
- Section can be used with or without an exportId — without exportId it acts as a generic container with just title/description
- InstallBlock should only appear once per page, not per-section
- Group exports logically by functionality, not alphabetically

CRITICAL: Output raw JSONL lines only. Do NOT wrap output in markdown code fences (\`\`\`json or \`\`\`). No prose, no explanation — just JSONL patch lines.`;

  // Append refinement context when iterating on an existing layout
  if (opts?.currentSpec) {
    prompt += `

## Current Layout (Refinement Mode)

You are refining an existing layout. Output a COMPLETE replacement spec as JSONL — the compiler starts fresh each turn.

Rules:
- ONLY change what the user asked for. Keep everything else exactly as-is.
- Preserve all element keys, types, props, and children order unless the user explicitly asks to change them.
- If the user says "remove X", remove only that element and its references from parent children arrays. Do not reorganize or simplify other elements.
- If the user says "move X", reorder the children array. Do not change element types or props.
- If the user says "add X", add a new element. Do not modify existing elements.

Current spec:
${JSON.stringify(opts.currentSpec, null, 2)}`;
  }

  return prompt;
}
