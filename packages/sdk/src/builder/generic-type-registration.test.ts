import { describe, expect, test } from 'bun:test';
import type { SpecType } from '@openpkg-ts/spec';
import { extract } from './spec-builder';

/** Every generic here is first reached through an instantiation. */
const GENERICS = `
interface Box<T> { value: T; map<U>(f: (t: T) => U): Box<U> }
type Pair<A, B> = { a: A; b: B };
type Either<L, R> = { left: L } | { right: R };
type Creator<T, M = []> = ((set: (t: T) => void) => T) & { $$m?: M };
class Cell<T> { constructor(public current: T) {} }

export declare function box(): Box<string>;
export declare function pair(): Pair<number, boolean>;
export declare function either(e: Either<string, number>): void;
export declare function creator<S>(init: S): Creator<S, [['x', S]]>;
export declare function cell(): Cell<Date>;
`;

async function typesOf(code: string, only?: string[]): Promise<Map<string, SpecType>> {
  const { spec } = await extract({
    entryFile: 'test.ts',
    content: code,
    ...(only ? { only } : {}),
  });
  return new Map(spec.types?.map((t) => [t.id, t]));
}

const props = (t: SpecType | undefined) =>
  (t?.schema as { properties?: Record<string, unknown> } | undefined)?.properties;

describe('generic types register from their declaration', () => {
  test('interface, object alias and class keep their type parameters', async () => {
    const types = await typesOf(GENERICS);

    expect(props(types.get('Box'))?.value).toEqual({ 'x-ts-type': 'T' });
    expect(props(types.get('Pair'))).toEqual({ a: { 'x-ts-type': 'A' }, b: { 'x-ts-type': 'B' } });
    expect(props(types.get('Cell'))?.current).toEqual({ 'x-ts-type': 'T' });
  });

  test('union and intersection aliases keep their type parameters', async () => {
    const types = await typesOf(GENERICS);

    expect((types.get('Either')?.schema as { anyOf?: unknown[] }).anyOf).toEqual([
      { type: 'object', properties: { left: { 'x-ts-type': 'L' } }, required: ['left'] },
      { type: 'object', properties: { right: { 'x-ts-type': 'R' } }, required: ['right'] },
    ]);

    const creator = JSON.stringify(types.get('Creator')?.schema);
    expect(creator).toContain('"x-ts-function":true');
    expect(creator).toContain('"$$m"');
    // No trace of the instantiation that reached it first
    expect(creator).not.toContain('"S"');
  });

  test('the same entry whichever export reaches the type first', async () => {
    const full = await typesOf(GENERICS);
    const viaPair = await typesOf(
      `${GENERICS}\nexport declare function other(): Pair<string, string>;`,
      ['other'],
    );

    expect(viaPair.get('Pair')).toEqual(full.get('Pair') as SpecType);
  });
});
