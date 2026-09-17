export const JEV_MODEL = 'typesafe-ai/jev';
export const JEV_CONFIDENCE = 0.5;

export type EvaluateRequest = {
  model: string;
  state: unknown;
  questions: Record<
    string,
    {
      type: 'choice';
      instructions: string;
      criteria: Record<string, string>;
    }
  >;
  providerOptions?: { gateway?: { zeroDataRetention?: boolean } };
};

export type EvaluateResult = {
  answers: Record<
    string,
    {
      choice: string;
      probabilities?: Record<string, number>;
    }
  >;
  providerMetadata?: { typesafe?: { confidence?: Record<string, number> } };
};

export type EvaluateFn = (request: EvaluateRequest) => Promise<EvaluateResult>;

export async function loadEvaluate(): Promise<EvaluateFn> {
  try {
    const specifier = 'ai';
    const mod = (await import(specifier)) as {
      experimental_evaluate: (req: EvaluateRequest) => Promise<EvaluateResult>;
    };
    if (typeof mod.experimental_evaluate !== 'function') {
      throw new Error('ai.experimental_evaluate is not a function');
    }
    return (request) =>
      mod.experimental_evaluate({
        ...request,
        providerOptions: {
          gateway: { zeroDataRetention: true },
          ...request.providerOptions,
        },
      });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`--jev requires the ai package (AI SDK ≥7.0.105): bun add ai\n${msg}`);
  }
}

export function choiceConfidence(result: EvaluateResult, id: string, choice: string): number {
  const named = result.providerMetadata?.typesafe?.confidence?.[id];
  if (typeof named === 'number') return named;
  const p = result.answers[id]?.probabilities?.[choice];
  return typeof p === 'number' ? p : 0;
}

export async function jevChoice(args: {
  evaluate: EvaluateFn;
  state: unknown;
  instructions: string;
  criteria: Record<string, string>;
  id?: string;
}): Promise<{ choice: string; confidence: number } | null> {
  const keys = Object.keys(args.criteria);
  if (keys.length < 2) return null;
  const id = args.id ?? 'choice';
  const result = await args.evaluate({
    model: JEV_MODEL,
    state: JSON.parse(JSON.stringify(args.state)),
    questions: {
      [id]: {
        type: 'choice',
        instructions: args.instructions,
        criteria: args.criteria,
      },
    },
    providerOptions: { gateway: { zeroDataRetention: true } },
  });
  const choice = result.answers[id]?.choice;
  if (!choice || !(choice in args.criteria)) return null;
  return { choice, confidence: choiceConfidence(result, id, choice) };
}
