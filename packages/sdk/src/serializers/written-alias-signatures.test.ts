import { describe, expect, test } from 'bun:test';
import type { OpenPkg, SpecSchema } from '@openpkg-ts/spec';
import { extract } from '../builder/spec-builder';

/** zustand redux's shape: the return is written as a generic intersection alias. */
const ALIASED = `
type Write<T, U> = Omit<T, keyof U> & U;
type ReduxState<A> = { dispatch: (a: A) => A };
type Creator<T, Mos extends unknown[] = []> = ((set: (t: T) => void) => T) & { $$mutators?: Mos };
type Either<L, R> = { left: L } | { right: R };
interface Options<D> { fallback?: D; retries?: number }
type Config<D> = Partial<Options<D>> & { strict?: boolean };

export declare function redux<T, A>(
  reducer: (state: T, action: A) => T,
  initial: T,
): Creator<Write<T, ReduxState<A>>, [['redux', A]]>;
export declare function pick(e: Either<string, number>): Either<boolean, null>;
export declare function configure<D>(config: Config<D>, options?: Options<D>): void;
export declare function structural(): { a: number } & { b: string };

type Mutate<S, Ms> = Ms extends [] ? S : Ms extends [infer M, ...infer R] ? Mutate<S & M, R> : never;
interface Api<T> { get(): T }
type Bound<S> = { (): S } & S;
export declare function create<T, Mos extends unknown[]>(init: T): Bound<Mutate<Api<T>, Mos>>;
`;

async function specOf(code: string): Promise<OpenPkg> {
  return (await extract({ entryFile: 'test.ts', content: code })).spec;
}

function signature(spec: OpenPkg, name: string) {
  const sig = spec.exports.find((e) => e.name === name)?.signatures?.[0];
  if (!sig) throw new Error(`no signature for ${name}`);
  return sig;
}

describe('signature types written as a generic alias', () => {
  test('intersection alias return keeps the written reference', async () => {
    const spec = await specOf(ALIASED);

    expect(signature(spec, 'redux').returns?.schema).toEqual({
      $ref: '#/types/Creator',
      'x-ts-type-arguments': [
        {
          $ref: '#/types/Write',
          'x-ts-type-arguments': [
            { 'x-ts-type': 'T' },
            { $ref: '#/types/ReduxState', 'x-ts-type-arguments': [{ 'x-ts-type': 'A' }] },
          ],
        },
        {
          type: 'array',
          prefixItems: [
            {
              type: 'array',
              prefixItems: [{ type: 'string', enum: ['redux'] }, { 'x-ts-type': 'A' }],
              minItems: 2,
              maxItems: 2,
            },
          ],
          minItems: 1,
          maxItems: 1,
        },
      ],
    } as SpecSchema);
  });

  test('the alias stays registered with its own shape', async () => {
    const spec = await specOf(ALIASED);
    const creator = spec.types?.find((t) => t.id === 'Creator');
    const arms = (creator?.schema as { allOf?: Record<string, unknown>[] }).allOf;

    expect(creator?.typeParameters?.map((p) => p.name)).toEqual(['T', 'Mos']);
    expect(arms?.[0]['x-ts-function']).toBe(true);
    expect(arms?.[1]).toMatchObject({ properties: { $$mutators: { 'x-ts-type': 'Mos' } } });
    expect(spec.types?.find((t) => t.id === 'Write')).toBeDefined();
  });

  test('union alias parameters and returns', async () => {
    const spec = await specOf(ALIASED);
    const sig = signature(spec, 'pick');

    expect(sig.parameters?.[0].schema).toEqual({
      $ref: '#/types/Either',
      'x-ts-type-arguments': [{ type: 'string' }, { type: 'number' }],
    } as SpecSchema);
    expect(sig.returns?.schema).toEqual({
      $ref: '#/types/Either',
      'x-ts-type-arguments': [{ type: 'boolean' }, { type: 'null' }],
    } as SpecSchema);
    expect(
      (spec.types?.find((t) => t.id === 'Either')?.schema as { anyOf?: unknown[] }).anyOf,
    ).toHaveLength(2);
  });

  test('an options parameter still resolves to an object shape through types[]', async () => {
    const spec = await specOf(ALIASED);
    const [config, options] = signature(spec, 'configure').parameters ?? [];

    expect(config.schema).toMatchObject({ $ref: '#/types/Config' });
    expect(options.schema).toMatchObject({ $ref: '#/types/Options' });
    const shape = JSON.stringify(spec.types?.find((t) => t.id === 'Config')?.schema);
    expect(shape).toContain('"strict"');
    expect(shape).toContain('"retries"');
  });

  test('anonymous structural types still expand inline', async () => {
    const spec = await specOf(ALIASED);

    expect(signature(spec, 'structural').returns?.schema).toEqual({
      allOf: [
        { type: 'object', properties: { a: { type: 'number' } }, required: ['a'] },
        { type: 'object', properties: { b: { type: 'string' } }, required: ['b'] },
      ],
    } as SpecSchema);
  });

  test('an argument that degrades to text reads as written, not as its alias body', async () => {
    const spec = await specOf(ALIASED);

    expect(signature(spec, 'create').returns?.schema).toEqual({
      $ref: '#/types/Bound',
      'x-ts-type-arguments': [{ 'x-ts-type': 'Mutate<Api<T>, Mos>' }],
    } as SpecSchema);
  });
});
