import { describe, expect, test } from 'bun:test';
import type { OpenPkg, SpecSchema } from '@openpkg-ts/spec';
import { extract } from '../builder/spec-builder';

/**
 * Utility-type instantiations (Omit, Pick, Partial, Record, ...) must flatten
 * to their effective members instead of emitting `$ref: #/types/Omit` — lib
 * types are never registered in types[], so those refs dangle.
 */

const code = `
export interface Config {
  api_host?: string;
  debug?: boolean;
  loaded: boolean;
}

export type EffectiveConfig = Omit<Config, 'loaded'> & { ready: boolean };

export function makeUser(opts: Omit<Config, 'debug'>, dict: Record<string, number>): void {}

export function generic<T>(x: Omit<T, 'id'>): void {}
`;

async function extractFixture() {
  const { spec } = await extract({ entryFile: 'utility-types-fixture.ts', content: code });
  return spec;
}

describe('utility type flattening', () => {
  test('Omit<Config, K> in a parameter flattens to effective members', async () => {
    const spec = await extractFixture();
    const makeUser = spec.exports.find((e) => e.name === 'makeUser');
    const params = makeUser?.signatures?.[0].parameters;
    const opts = params?.find((p) => p.name === 'opts')?.schema as Record<string, unknown>;

    expect(opts.$ref).toBeUndefined();
    expect(opts.type).toBe('object');
    expect(Object.keys(opts.properties as object).sort()).toEqual(['api_host', 'loaded']);
    // debug omitted; api_host stays optional
    expect(opts.required).toEqual(['loaded']);
  });

  test('Record<string, V> emits additionalProperties', async () => {
    const spec = await extractFixture();
    const makeUser = spec.exports.find((e) => e.name === 'makeUser');
    const dict = makeUser?.signatures?.[0].parameters?.find((p) => p.name === 'dict')
      ?.schema as Record<string, unknown>;

    expect(dict.$ref).toBeUndefined();
    expect(dict.additionalProperties).toEqual({ type: 'number' });
  });

  test('alias intersection with Omit flattens inside allOf', async () => {
    const spec = await extractFixture();
    const effective = spec.exports.find((e) => e.name === 'EffectiveConfig');
    const schema = effective?.schema as { allOf?: SpecSchema[] };

    expect(schema.allOf).toBeDefined();
    const [omitPart, literalPart] = schema.allOf as Array<Record<string, unknown>>;
    expect(omitPart.$ref).toBeUndefined();
    expect(Object.keys(omitPart.properties as object).sort()).toEqual(['api_host', 'debug']);
    // The object-literal branch must survive alongside the Omit branch
    expect(literalPart).toBeDefined();
    expect(Object.keys(literalPart.properties as object)).toEqual(['ready']);
    expect(literalPart.required).toEqual(['ready']);
  });

  test('deferred instantiation in generic context keeps the written form', async () => {
    const spec = await extractFixture();
    const generic = spec.exports.find((e) => e.name === 'generic');
    const x = generic?.signatures?.[0].parameters?.[0]?.schema as Record<string, unknown>;

    // Lib utilities are never registered in types[], so no $ref. Written
    // `x-ts-type` is the encoding — `$ref` + args is for named types
    // (ReadonlyMap), not mapped lib aliases (Readonly/Partial/Omit).
    expect(x.$ref).toBeUndefined();
    expect(x.type).toBeUndefined();
    expect(x['x-ts-type']).toBe("Omit<T, 'id'>");
  });
});

const LIVE_OBJECT = `
export class LiveObject<T extends Record<string, unknown>> {
  constructor(initial?: Partial<T>) {}
  toImmutable(): Readonly<T> { return {} as Readonly<T>; }
  toObject(): T { return {} as T; }
}
export class LiveList<T = unknown> {
  toImmutable(): readonly T[] { return []; }
}
export class LiveMap<V = unknown> {
  toImmutable(): ReadonlyMap<string, V> { return new Map(); }
}
export function wrap<T>(
  partial: Partial<T>,
  required: Required<T>,
  record: Record<string, T>,
  nullable: NonNullable<T>,
  awaited: Awaited<T>,
): void {}
`;

function classMember(spec: OpenPkg, name: string, member: string) {
  const exp = spec.exports.find((e) => e.name === name);
  if (!exp) throw new Error(`missing export ${name}`);
  const m = exp.members?.find((x) => x.name === member);
  if (!m) throw new Error(`missing member ${name}.${member}`);
  return m;
}

describe('utility types over unresolved type parameters', () => {
  test('Readonly<T> and Partial<T> keep the written form, not an empty object', async () => {
    const { spec } = await extract({ entryFile: 'live-object.ts', content: LIVE_OBJECT });

    const ret = classMember(spec, 'LiveObject', 'toImmutable').signatures?.[0]?.returns
      ?.schema as Record<string, unknown>;
    expect(ret).toEqual({ 'x-ts-type': 'Readonly<T>' });

    const toObject = classMember(spec, 'LiveObject', 'toObject').signatures?.[0]?.returns
      ?.schema as Record<string, unknown>;
    expect(toObject).toEqual({ 'x-ts-type': 'T' });

    const ctor = spec.exports.find((e) => e.name === 'LiveObject')?.signatures?.[0]?.parameters?.[0]
      ?.schema as Record<string, unknown>;
    expect(ctor).toEqual({ 'x-ts-type': 'Partial<T>' });
  });

  test('ReadonlyMap keeps $ref + type args; readonly T[] keeps array shape', async () => {
    const { spec } = await extract({ entryFile: 'live-object.ts', content: LIVE_OBJECT });

    const mapRet = classMember(spec, 'LiveMap', 'toImmutable').signatures?.[0]?.returns
      ?.schema as Record<string, unknown>;
    expect(mapRet).toMatchObject({
      $ref: '#/types/ReadonlyMap',
      'x-ts-type-arguments': [{ type: 'string' }, { 'x-ts-type': 'V' }],
    });

    const listRet = classMember(spec, 'LiveList', 'toImmutable').signatures?.[0]?.returns
      ?.schema as Record<string, unknown>;
    expect(listRet.type).toBe('array');
    expect(listRet.items).toEqual({ 'x-ts-type': 'T' });
    expect(listRet['x-ts-readonly']).toBe(true);
  });

  test('other utilities over T keep written form; concrete args still flatten', async () => {
    const { spec } = await extract({ entryFile: 'live-object.ts', content: LIVE_OBJECT });
    const params = spec.exports.find((e) => e.name === 'wrap')?.signatures?.[0]?.parameters;
    const byName = (n: string) =>
      params?.find((p) => p.name === n)?.schema as Record<string, unknown>;

    expect(byName('partial')).toEqual({ 'x-ts-type': 'Partial<T>' });
    expect(byName('required')).toEqual({ 'x-ts-type': 'Required<T>' });
    expect(byName('record')).toEqual({ 'x-ts-type': 'Record<string, T>' });
    expect(byName('nullable')).toEqual({ 'x-ts-type': 'NonNullable<T>' });
    expect(byName('awaited')).toEqual({ 'x-ts-type': 'Awaited<T>' });
  });

  test('a utility over a generic object with known keys flattens', async () => {
    const { spec } = await extract({
      entryFile: 'options.ts',
      content: `
        interface Options<D> { fallback?: D; retries: number }
        export declare function configure<D, T extends { id: string }>(
          config: Partial<Options<D>>,
          picked: Pick<Options<D>, 'retries'>,
          constrained: Partial<T>,
        ): void;
      `,
    });
    const params = spec.exports[0].signatures?.[0]?.parameters;
    const byName = (n: string) => params?.find((p) => p.name === n)?.schema;

    expect(byName('config')).toMatchObject({
      type: 'object',
      properties: { fallback: { 'x-ts-type': 'D' }, retries: { type: 'number' } },
    });
    expect((byName('config') as { required?: string[] }).required).toBeUndefined();
    expect(byName('picked')).toMatchObject({
      type: 'object',
      properties: { retries: { type: 'number' } },
      required: ['retries'],
    });
    // The constraint's keys are not T's
    expect(byName('constrained')).toEqual({ 'x-ts-type': 'Partial<T>' });
  });
});
