import { describe, expect, test } from 'bun:test';
import { extract } from './spec-builder';

/**
 * Recursive conditional/mapped types used as generic constraints (valibot
 * partialCheck / DeepPickN). Extraction must finish and not expand forever.
 */
const RECURSIVE = `
export type Paths = readonly (readonly (string | number)[])[];
type DeepPick<T, P> = P extends readonly [infer K, ...infer Rest]
  ? K extends keyof T
    ? Rest extends readonly []
      ? { [Key in K]: T[Key] }
      : { [Key in K]: DeepPick<T[Key], Rest> }
    : never
  : T;
export type DeepPickN<T, P extends Paths> = P extends readonly [infer First, ...infer Rest]
  ? Rest extends Paths
    ? DeepPick<T, First> & DeepPickN<T, Rest>
    : DeepPick<T, First>
  : T;
type LazyPath<V, P> = P extends readonly [infer K, ...infer Rest]
  ? K extends keyof V
    ? LazyPath<V[K], Rest>
    : never
  : [];
export type ValidPaths<V, P extends Paths> = { [K in keyof P]: LazyPath<V, P[K]> };
export function partialCheck<
  TInput extends object,
  const TPaths extends Paths,
  const TSelection extends DeepPickN<TInput, TPaths>,
>(paths: ValidPaths<TInput, TPaths>, requirement: (input: TSelection) => boolean): TSelection {
  return null as unknown as TSelection;
}
`;

describe('recursive generic constraint expansion is bounded', () => {
  test('partialCheck-shaped export finishes and keeps a return type', async () => {
    const started = Date.now();
    const { spec, diagnostics } = await extract({
      entryFile: 'test.ts',
      content: RECURSIVE,
    });
    expect(Date.now() - started).toBeLessThan(5_000);
    const fn = spec.exports.find((e) => e.name === 'partialCheck');
    expect(fn).toBeDefined();
    expect(fn?.signatures?.[0]?.returns?.schema).toBeDefined();
    expect(JSON.stringify(fn?.signatures?.[0]?.returns?.schema)).not.toBe('{}');
    const constraint = fn?.typeParameters?.find((p) => p.name === 'TSelection')?.constraint;
    expect(constraint).toBeDefined();
    expect(constraint).toContain('DeepPickN');
    const budget = diagnostics.filter((d) => d.code === 'TYPE_EXPANSION_LIMIT');
    expect(budget.length).toBeGreaterThanOrEqual(1);
  });
});
