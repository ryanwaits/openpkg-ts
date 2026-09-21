import { describe, expect, test } from 'bun:test';
import type { SpecExport, SpecMember } from '@openpkg-ts/spec';
import { extract } from '../builder/spec-builder';

/** zod v4's shape: the instance type is an interface, the constructor a const of the same name. */
const ZODLIKE = `
type Ctor<T> = { new (def: unknown): T; init(inst: T): void };
declare function ctor<T>(name: string): Ctor<T>;

export interface BaseType<Out = unknown> {
  /** Parse or throw. */
  parse(data: unknown): Out;
  safeParse(data: unknown): { success: boolean; data?: Out };
  /** @deprecated use \`optional\` */
  maybe?(): this;
  optional(): this;
  readonly description?: string;
}

interface _Str<Out> extends BaseType<Out> {
  /** Minimum length. */
  min(value: number, message?: string): this;
  max(value: number, ...messages: string[]): this;
}

/** A string schema. */
export interface Str extends _Str<string> {
  /**
   * Must be an email.
   * @param params - message or options
   */
  email(params?: string | { message: string }): this;
  /** @deprecated use \`email\` */
  mail(): this;
  format?: string;
  optional(): this;
}
export const Str: Ctor<Str> = /*@__PURE__*/ ctor("Str");
`;

async function exportsOf(code: string): Promise<Map<string, SpecExport>> {
  const result = await extract({ entryFile: 'test.ts', content: code });
  return new Map(result.spec.exports.map((e) => [e.name, e]));
}

function member(exp: SpecExport | undefined, name: string): SpecMember | undefined {
  return exp?.members?.find((m) => m.name === name);
}

describe('value + interface under one name', () => {
  test('constructor const carries the interface members like a class', async () => {
    const str = (await exportsOf(ZODLIKE)).get('Str');

    expect(str?.kind).toBe('class');
    expect(str?.extends).toBe('_Str');
    expect(str?.description).toBe('A string schema.');

    const email = member(str, 'email');
    expect(email?.kind).toBe('method');
    expect(email?.description).toBe('Must be an email.');
    expect(email?.signatures).toHaveLength(1);
    expect(email?.signatures?.[0].parameters?.[0]).toMatchObject({
      name: 'params',
      required: false,
      description: 'message or options',
    });

    expect(member(str, 'mail')).toMatchObject({ kind: 'method', deprecated: true });
    expect(member(str, 'format')).toMatchObject({
      kind: 'property',
      schema: { type: 'string' },
      flags: { optional: true },
    });
  });

  test('inherited members come through extends with provenance', async () => {
    const str = (await exportsOf(ZODLIKE)).get('Str');

    const min = member(str, 'min') as SpecMember & { inheritedFrom?: string };
    expect(min).toMatchObject({
      kind: 'method',
      inheritedFrom: '_Str',
      description: 'Minimum length.',
    });
    expect(min.signatures?.[0].parameters?.map((p) => [p.name, p.required])).toEqual([
      ['value', true],
      ['message', false],
    ]);
    expect(member(str, 'max')?.signatures?.[0].parameters?.[1]).toMatchObject({
      name: 'messages',
      rest: true,
      required: false,
    });

    const parse = member(str, 'parse') as SpecMember & { inheritedFrom?: string };
    expect(parse).toMatchObject({ kind: 'method', inheritedFrom: 'BaseType' });
    // Base type arguments are applied: BaseType<Out> is BaseType<string> here.
    expect(parse.signatures?.[0].returns?.schema).toEqual({ type: 'string' });
    expect(member(str, 'safeParse')?.kind).toBe('method');

    expect(member(str, 'maybe')).toMatchObject({ flags: { optional: true }, deprecated: true });
    expect(member(str, 'description')).toMatchObject({
      kind: 'property',
      flags: { optional: true, readonly: true },
    });

    // Own declaration wins over the inherited one.
    const optionals = str?.members?.filter((m) => m.name === 'optional') ?? [];
    expect(optionals).toHaveLength(1);
    expect('inheritedFrom' in optionals[0]).toBe(false);
  });

  test('plain interface export is unchanged', async () => {
    const base = (await exportsOf(ZODLIKE)).get('BaseType');

    expect(base?.kind).toBe('interface');
    expect(base?.members?.map((m) => m.name).sort()).toEqual([
      'description',
      'maybe',
      'optional',
      'parse',
      'safeParse',
    ]);
  });

  test('declaration-merged interfaces and generics', async () => {
    const box = (
      await exportsOf(`
        export interface Box<T> { get(): T }
        export interface Box<T> { set(value: T): void }
        export const Box: { new <T>(value: T): Box<T> } = null as any;`)
    ).get('Box');

    expect(box?.kind).toBe('class');
    expect(box?.typeParameters).toEqual([{ name: 'T' }]);
    expect(box?.members?.map((m) => m.name).sort()).toEqual(['get', 'set']);
  });

  test('companion object keeps its value schema and gains the type members', async () => {
    const byName = await exportsOf(`
      export type Point = { x: number; y?: number; norm(): number };
      export const Point = { origin: { x: 0 } as Point };
      export interface Opts<T = string> { verbose: boolean; tag?: T }
      export function Opts(): Opts { return { verbose: true }; }`);

    const point = byName.get('Point');
    expect(point?.kind).toBe('variable');
    expect(point?.schema).toMatchObject({ type: 'object', properties: { origin: {} } });
    expect(point?.members?.map((m) => [m.name, m.kind])).toEqual([
      ['x', 'property'],
      ['y', 'property'],
      ['norm', 'method'],
    ]);

    const opts = byName.get('Opts');
    expect(opts?.kind).toBe('function');
    expect(opts?.signatures).toHaveLength(1);
    expect(opts?.members?.map((m) => m.name)).toEqual(['verbose', 'tag']);
    // The interface being generic does not make the function generic.
    expect(opts?.typeParameters).toBeUndefined();
  });

  test('a const with no type of the same name gains nothing', async () => {
    const plain = (await exportsOf(`export const Plain: { new (): object } = null as any;`)).get(
      'Plain',
    );

    expect(plain?.kind).toBe('class');
    expect(plain?.members).toBeUndefined();
  });
  test('constructor const carries construct signatures like a class', async () => {
    const byName = await exportsOf(`
      ${ZODLIKE}
      export interface Pair<A, B> { first: A; second: B }
      export const Pair: {
        /** From a tuple. */
        new <A, B>(entries: [A, B]): Pair<A, B>;
        new <A, B>(first: A, second?: B, ...rest: unknown[]): Pair<A, B>;
      } = null as any;`);

    expect(byName.get('Str')?.signatures).toHaveLength(1);
    expect(byName.get('Str')?.signatures?.[0].parameters).toMatchObject([
      { name: 'def', required: true },
    ]);

    const pair = byName.get('Pair');
    expect(pair?.signatures).toHaveLength(2);
    expect(pair?.signatures?.[0]).toMatchObject({ description: 'From a tuple.', overloadIndex: 0 });
    expect(pair?.signatures?.[1].parameters?.map((p) => [p.name, p.required, p.rest])).toEqual([
      ['first', true, undefined],
      ['second', false, undefined],
      ['rest', false, true],
    ]);
  });

  test('constructor const of another name takes members from what it constructs', async () => {
    const real = (
      await exportsOf(`
        type Ctor<T> = { new (issues: string[]): T };
        interface BaseErr { readonly issues: string[] }
        /** A thrown error. */
        export interface Err extends BaseErr { flatten(): string }
        export const RealErr: Ctor<Err> = null as any;`)
    ).get('RealErr');

    expect(real?.kind).toBe('class');
    expect(real?.members?.map((m) => m.name)).toEqual(['flatten', 'issues']);
    expect(member(real, 'issues')).toMatchObject({ inheritedFrom: 'BaseErr' });
    expect(real?.signatures?.[0].parameters?.[0]).toMatchObject({ name: 'issues' });
  });

  test('constructor const of a lib type does not inline the lib surface', async () => {
    const stamp = (await exportsOf(`export const Stamp: { new (): Date } = null as any;`)).get(
      'Stamp',
    );

    expect(stamp?.kind).toBe('class');
    expect(stamp?.members).toBeUndefined();
  });

  test('interface merged onto a class adds its members', async () => {
    const foo = (
      await exportsOf(`
        class Base { base(): void {} }
        interface Mixin { mixed(): number }
        export class Foo extends Base { own(): string { return ''; } dup(): void {} }
        export interface Foo extends Mixin {
          /** Declared by merging. */
          extra(flag?: boolean): void;
          dup(): void;
        }`)
    ).get('Foo');

    expect(foo?.kind).toBe('class');
    expect(foo?.extends).toBe('Base');
    expect(foo?.members?.map((m) => m.name).sort()).toEqual([
      'base',
      'dup',
      'extra',
      'mixed',
      'own',
    ]);
    expect(member(foo, 'extra')).toMatchObject({
      kind: 'method',
      description: 'Declared by merging.',
    });
    expect(member(foo, 'mixed')).toMatchObject({ inheritedFrom: 'Mixin' });

    // An empty class keeps its own shape: the interface only adds members.
    const bag = (
      await exportsOf(`
        interface Sized { size: number }
        export class Bag {}
        export interface Bag extends Sized { put(value: string): void }`)
    ).get('Bag');
    expect(bag?.extends).toBeUndefined();
    expect(bag?.members?.map((m) => m.name).sort()).toEqual(['put', 'size']);
  });
});
