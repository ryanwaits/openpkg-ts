import { describe, expect, test } from 'bun:test';
import type { SpecSchema } from '@openpkg-ts/spec';
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

  test('deferred instantiation in generic context inlines structural schema', async () => {
    const spec = await extractFixture();
    const generic = spec.exports.find((e) => e.name === 'generic');
    const x = generic?.signatures?.[0].parameters?.[0]?.schema as Record<string, unknown>;

    // Omit<T, 'id'> with T unresolved has no members to flatten. Lib utility
    // types are never registered in types[], so no $ref — structural
    // approximation with the instantiation preserved via x-ts extensions.
    expect(x.$ref).toBeUndefined();
    expect(x).toMatchObject({ type: 'object', 'x-ts-type': 'Omit' });
    expect(Array.isArray(x['x-ts-type-arguments'])).toBe(true);
  });
});
