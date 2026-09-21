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
});
