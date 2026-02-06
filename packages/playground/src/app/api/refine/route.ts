import { generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { sampleSpec } from '@/lib/sample-spec';

interface SpecElement {
  key: string;
  type: string;
  props: Record<string, unknown>;
  children: string[];
  parentKey: string;
}

interface RefineRequest {
  elementKey: string;
  instruction: string;
  currentSpec: {
    root: string;
    elements: Record<string, SpecElement>;
  };
}

const CODE_COMPONENT_TYPES = new Set(['CodeBlock', 'APISection', 'APISectionSingle', 'ExportSection']);

/** Resolve the default code for an exportId from the sample spec */
function resolveDefaultCode(exportId: string): string | null {
  const exp = sampleSpec.exports.find((e) => e.id === exportId);
  if (!exp) return null;

  const examples = exp.examples ?? exp.signatures?.[0]?.examples ?? [];
  const first = examples[0];
  if (!first) return null;
  return typeof first === 'string' ? first : first.code;
}

/** Resolve the current code value for a component */
function resolveCodeForElement(element: SpecElement): string | null {
  if (!CODE_COMPONENT_TYPES.has(element.type)) return null;

  const exportId = element.props.exportId as string | undefined;
  if (!exportId) return null;

  if (typeof element.props.code === 'string') return element.props.code;

  return resolveDefaultCode(exportId);
}

export async function POST(req: Request) {
  try {
    const { elementKey, instruction, currentSpec } = (await req.json()) as RefineRequest;

    const element = currentSpec.elements[elementKey];
    if (!element) {
      return Response.json({ error: `Element "${elementKey}" not found` }, { status: 400 });
    }

    // Gather child elements for context
    const childElements: Record<string, SpecElement> = {};
    const collectChildren = (key: string) => {
      const el = currentSpec.elements[key];
      if (!el) return;
      for (const childKey of el.children) {
        childElements[childKey] = currentSpec.elements[childKey];
        collectChildren(childKey);
      }
    };
    collectChildren(elementKey);

    // Resolve current code for the element and relevant children
    const resolvedCode = resolveCodeForElement(element);
    const childCodeContext: string[] = [];
    for (const [key, child] of Object.entries(childElements)) {
      const code = resolveCodeForElement(child);
      if (code) {
        childCodeContext.push(`Element "${key}" (${child.type}, exportId="${child.props.exportId}") current code:\n\`\`\`\n${code}\n\`\`\``);
      }
    }

    const prompt = `You are modifying a single element in a UI layout spec.

Element key: "${elementKey}"
Element type: ${element.type}

Current element JSON:
${JSON.stringify(element, null, 2)}

${resolvedCode ? `Current rendered code for this element:\n\`\`\`\n${resolvedCode}\n\`\`\`\n` : ''}
${Object.keys(childElements).length > 0 ? `Child elements:\n${JSON.stringify(childElements, null, 2)}` : ''}
${childCodeContext.length > 0 ? `\nResolved code for children:\n${childCodeContext.join('\n\n')}` : ''}

## Editable Props

Components that render code (CodeBlock, APISection, APISectionSingle) accept these optional override props:
- "code": string — overrides the default code example. Set this to inject annotations or modify displayed code.
- "codeLang": string — overrides the language (e.g. "typescript", "bash")

To modify code content, set the "code" prop on the element to the full modified code string.

## CodeHike Annotations

Add these as line comments inside the "code" string value. Place each annotation comment on the line ABOVE the target line:

Line annotations (full line):
- // !mark — highlight entire line (default color)
- // !mark[1] — highlight with color variant 1
- // !mark[2] — highlight with color variant 2
- // !diff + — show line as added (green)
- // !diff - — show line as removed (red)
- // !collapse — collapsible block (starts open), all lines below become collapsible
- // !collapse collapsed — same but starts closed
- // !expandable — fade gradient + "Expand" button, hides lines below until clicked. Use on long code blocks, place on the first line to start collapsed from.

Inline annotations (within a line, use curly braces in code):
- // !mark[/pattern/] — highlight matched text inline
- // !link[/pattern/] https://url — make matched text a clickable link
- // !callout[/pattern/] label — tooltip/callout below the matched text

Flags (set on the "flags" prop, not in code):
- "c" — copy button (default)
- "n" — line numbers
- "w" — word wrap

User instruction: "${instruction}"

Return ONLY the updated element JSON object for "${elementKey}". If child elements also need changes, return a JSON object with ALL modified elements keyed by their element key:
{ "${elementKey}": { ...updated }, "child-key": { ...updated } }

If only the target element changes, return just that single element object (not wrapped in a key).

No markdown fences, no explanation, just valid JSON.`;

    const result = await generateText({
      model: anthropic('claude-sonnet-4-5-20250929'),
      prompt,
      maxTokens: 4096,
    });

    // Parse the response — strip markdown fences if present
    let text = result.text.trim();
    text = text.replace(/^```(?:json)?\n?/gm, '').replace(/\n?```\s*$/gm, '').trim();
    let parsed: Record<string, unknown>;

    try {
      parsed = JSON.parse(text);
    } catch (parseErr) {
      console.error('Failed to parse LLM response:', text);
      return Response.json({ error: 'Failed to parse LLM response', raw: text }, { status: 500 });
    }

    // Determine if response is a single element or a map of elements
    let patches: Record<string, SpecElement>;

    if (parsed.key && parsed.type) {
      patches = { [elementKey]: parsed as unknown as SpecElement };
    } else {
      patches = parsed as unknown as Record<string, SpecElement>;
    }

    // Apply patches to spec
    const updatedElements = { ...currentSpec.elements };
    for (const [key, patch] of Object.entries(patches)) {
      if (updatedElements[key]) {
        updatedElements[key] = patch;
      }
    }

    return Response.json({
      spec: { root: currentSpec.root, elements: updatedElements },
    });
  } catch (err) {
    console.error('API /refine error:', err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
