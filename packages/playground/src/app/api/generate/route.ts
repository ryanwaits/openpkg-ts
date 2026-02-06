import { streamText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { buildSystemPrompt } from '@openpkg-ts/json-render/server';
import { sampleSpec } from '@/lib/sample-spec';

export async function POST(req: Request) {
  try {
    const { prompt, spec, currentSpec } = await req.json();
    const openpkgSpec = spec ?? sampleSpec;
    const systemPrompt = buildSystemPrompt(openpkgSpec, { currentSpec });

    const result = streamText({
      model: anthropic('claude-sonnet-4-5-20250929'),
      system: systemPrompt,
      prompt,
    });

    return result.toTextStreamResponse();
  } catch (err) {
    console.error('API /generate error:', err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
