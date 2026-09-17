import {
  type EvaluateFn,
  type EvaluateQuestion,
  JEV_CONFIDENCE,
  jevEvaluate,
  MAX_JEV_QUESTIONS,
  namedConfidence,
} from '../core/decisions';
import type { Diagnostic } from '../types';

export type ExternalRef = { typeName: string; package: string };

export const FOLLOW_SCORE_LEVELS = [
  'opaque — a stub is enough',
  'useful — expanding helps',
  'essential — needed to understand the public API',
];

const AMBIGUOUS_CODES = new Set([
  'FORGOTTEN_EXPORT',
  'SERIALIZATION_FAILED',
  'RUNTIME_SCHEMA_ERROR',
]);

export async function selectFollowExternal(
  refs: ExternalRef[],
  evaluate: EvaluateFn,
): Promise<string[]> {
  const sliced = refs.slice(0, MAX_JEV_QUESTIONS);
  if (!sliced.length) return [];
  const questions: Record<string, EvaluateQuestion> = {};
  for (const [i, ref] of sliced.entries()) {
    questions[`t${i}`] = {
      type: 'score',
      instructions: `How load-bearing is ${ref.typeName} from ${ref.package} for understanding this public TypeScript API?`,
      criteria: FOLLOW_SCORE_LEVELS,
    };
  }
  const result = await jevEvaluate(
    evaluate,
    {
      types: sliced,
      task: 'OpenPkg extracts a public TS API. Stub opaque externals; expand load-bearing ones.',
    },
    questions,
  );
  const follow = new Set<string>();
  for (const [i, ref] of sliced.entries()) {
    const id = `t${i}`;
    const score = result.answers[id]?.score;
    if (typeof score !== 'number') continue;
    const conf = namedConfidence(result, id) ?? (score >= 1.5 || score <= 0.5 ? 1 : 0);
    if (score >= 1.5 || (score >= 1 && conf >= JEV_CONFIDENCE)) follow.add(ref.package);
  }
  return [...follow];
}

export async function calibrateDiagnostics(
  diagnostics: Diagnostic[],
  evaluate: EvaluateFn,
): Promise<void> {
  const targets = diagnostics
    .map((d, index) => ({ d, index }))
    .filter(({ d }) => d.code && AMBIGUOUS_CODES.has(d.code))
    .slice(0, MAX_JEV_QUESTIONS);
  if (targets.length < 1) return;
  const questions: Record<string, EvaluateQuestion> = {};
  for (const [i, { d }] of targets.entries()) {
    questions[`d${i}`] = {
      type: 'choice',
      instructions: `What severity should this extraction diagnostic have? ${d.message}`,
      criteria: {
        error: 'Blocks a correct spec',
        warning: 'Likely a real API gap',
        info: 'Informational only',
      },
    };
  }
  const result = await jevEvaluate(
    evaluate,
    {
      diagnostics: targets.map(({ d }) => ({
        code: d.code,
        message: d.message,
        severity: d.severity,
      })),
    },
    questions,
  );
  for (const [i, { d }] of targets.entries()) {
    const id = `d${i}`;
    const choice = result.answers[id]?.choice;
    if (choice !== 'error' && choice !== 'warning' && choice !== 'info') continue;
    const conf = namedConfidence(result, id) ?? result.answers[id]?.probabilities?.[choice] ?? 0;
    if (conf < JEV_CONFIDENCE) continue;
    d.severity = choice;
  }
}
