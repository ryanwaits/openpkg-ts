import { describe, expect, test } from 'bun:test';
import { extract } from '../builder/spec-builder';

/**
 * Behavior-pinning tests for the compiler API hardening work (removing
 * internal `checker.getUnionType()`, internal `isThisType` reads, numeric
 * TypeFlags/ObjectFlags literals, and CommonJS/node10 default compiler
 * options). These tests were written and passed against the UNMODIFIED
 * source — they pin exact current output so the hardening changes can be
 * verified as zero-behavior-change.
 */

describe('optional parameter schemas (stripUndefinedFromType, schema path)', () => {
  test('multi-member union, no null', async () => {
    const code = `export function fn(x?: string | number) {}`;
    const result = await extract({ entryFile: 'test.ts', content: code });
    const fn = result.spec.exports.find((e) => e.name === 'fn');
    const param = fn?.signatures?.[0]?.parameters?.[0];
    expect(param?.schema).toEqual({
      anyOf: [{ type: 'string' }, { type: 'number' }],
    });
  });

  test('the null case: string | null', async () => {
    const code = `export function fn(x?: string | null) {}`;
    const result = await extract({ entryFile: 'test.ts', content: code });
    const fn = result.spec.exports.find((e) => e.name === 'fn');
    const param = fn?.signatures?.[0]?.parameters?.[0];
    expect(param?.schema).toEqual({
      anyOf: [{ type: 'null' }, { type: 'string' }],
    });
  });

  test('the null case: string | number | null (null + 2 members)', async () => {
    const code = `export function fn(x?: string | number | null) {}`;
    const result = await extract({ entryFile: 'test.ts', content: code });
    const fn = result.spec.exports.find((e) => e.name === 'fn');
    const param = fn?.signatures?.[0]?.parameters?.[0];
    expect(param?.schema).toEqual({
      anyOf: [{ type: 'null' }, { type: 'string' }, { type: 'number' }],
    });
  });

  test('boolean stays a single boolean type, never split true/false', async () => {
    const code = `export function fn(x?: boolean) {}`;
    const result = await extract({ entryFile: 'test.ts', content: code });
    const fn = result.spec.exports.find((e) => e.name === 'fn');
    const param = fn?.signatures?.[0]?.parameters?.[0];
    expect(param?.schema).toEqual({ type: 'boolean' });
  });

  test('inline literal union', async () => {
    const code = `export function fn(x?: 'a' | 'b') {}`;
    const result = await extract({ entryFile: 'test.ts', content: code });
    const fn = result.spec.exports.find((e) => e.name === 'fn');
    const param = fn?.signatures?.[0]?.parameters?.[0];
    expect(param?.schema).toEqual({ type: 'string', enum: ['a', 'b'] });
  });

  test('named type alias literal union', async () => {
    const code = `export type Foo = 'a' | 'b';\nexport function fn(x?: Foo) {}`;
    const result = await extract({ entryFile: 'test.ts', content: code });
    const fn = result.spec.exports.find((e) => e.name === 'fn');
    const param = fn?.signatures?.[0]?.parameters?.[0];
    expect(param?.schema).toEqual({ type: 'string', enum: ['a', 'b'] });
  });

  test('explicit string | undefined', async () => {
    const code = `export function fn(x?: string | undefined) {}`;
    const result = await extract({ entryFile: 'test.ts', content: code });
    const fn = result.spec.exports.find((e) => e.name === 'fn');
    const param = fn?.signatures?.[0]?.parameters?.[0];
    expect(param?.schema).toEqual({ type: 'string' });
  });

  test('named interface type', async () => {
    const code = `export interface Bar { id: string }\nexport function fn(x?: Bar) {}`;
    const result = await extract({ entryFile: 'test.ts', content: code });
    const fn = result.spec.exports.find((e) => e.name === 'fn');
    const param = fn?.signatures?.[0]?.parameters?.[0];
    expect(param?.schema).toEqual({ $ref: '#/types/Bar' });
  });

  test('destructured optional property', async () => {
    const code = `export function destructured({ mode }: { mode?: 'dev' | 'prod' }) {}`;
    const result = await extract({ entryFile: 'test.ts', content: code });
    const fn = result.spec.exports.find((e) => e.name === 'destructured');
    const param = fn?.signatures?.[0]?.parameters?.[0];
    expect(param?.name).toBe('mode');
    expect(param?.schema).toEqual({ type: 'string', enum: ['dev', 'prod'] });
  });
});

describe('optional property x-ts-type text (stripUndefinedFromType, text path)', () => {
  test('interface with mixed optional union properties', async () => {
    const code = `
export interface TextIface {
  a?: string | number;
  b?: string | null;
  c?: string | number | null;
  d?: string;
}
`;
    const result = await extract({ entryFile: 'test.ts', content: code });
    const iface = result.spec.exports.find((e) => e.name === 'TextIface');
    const members = iface?.members ?? [];
    const byName = (name: string) => members.find((m) => m.name === name);

    expect((byName('a')?.schema as Record<string, unknown>)?.['x-ts-type']).toBe(
      'string | number',
    );
    expect((byName('b')?.schema as Record<string, unknown>)?.['x-ts-type']).toBe('string | null');
    expect((byName('c')?.schema as Record<string, unknown>)?.['x-ts-type']).toBe(
      'string | number | null',
    );
    // 'd' is a bare primitive keyword — derivable, so no x-ts-type is emitted.
    expect((byName('d')?.schema as Record<string, unknown>)?.['x-ts-type']).toBeUndefined();
  });
});

describe('fluent `this` type (isThisType, both sites)', () => {
  test('class method returning `this`', async () => {
    const code = `
export class Cls {
  add(item: string): this { return this; }
}
`;
    const result = await extract({ entryFile: 'test.ts', content: code });
    const cls = result.spec.exports.find((e) => e.name === 'Cls');
    const method = cls?.members?.find((m) => m.name === 'add');
    const ret = method?.signatures?.[0]?.returns?.schema as Record<string, unknown>;
    expect(ret?.$ref).toBe('#/types/Cls');
    expect(ret?.['x-ts-type']).toBe('this');
  });

  test('interface method returning `this`', async () => {
    const code = `
export interface IFace2 {
  next(): this;
}
`;
    const result = await extract({ entryFile: 'test.ts', content: code });
    const iface = result.spec.exports.find((e) => e.name === 'IFace2');
    const method = iface?.members?.find((m) => m.name === 'next');
    const ret = method?.signatures?.[0]?.returns?.schema as Record<string, unknown>;
    expect(ret?.$ref).toBe('#/types/IFace2');
    expect(ret?.['x-ts-type']).toBe('this');
  });

  test('generic class type parameters are NOT marked as `this`', async () => {
    const code = `
export class Wrapper<T> {
  value!: T;
  map<U>(fn: (v: T) => U): U { return fn(this.value); }
}
`;
    const result = await extract({ entryFile: 'test.ts', content: code });
    const cls = result.spec.exports.find((e) => e.name === 'Wrapper');
    const value = cls?.members?.find((m) => m.name === 'value');
    const map = cls?.members?.find((m) => m.name === 'map');

    // `T` and `U` are ordinary type parameters — plain x-ts-type text, no $ref.
    expect(value?.schema).toEqual({ 'x-ts-type': 'T' });
    const mapReturn = map?.signatures?.[0]?.returns?.schema as Record<string, unknown>;
    expect(mapReturn).toEqual({ 'x-ts-type': 'U' });
    expect(mapReturn?.$ref).toBeUndefined();
  });

  test('site 1 (buildMaxDepthSchema): `this` return at the depth cap', async () => {
    // maxTypeDepth: 0 forces every schema build through buildMaxDepthSchema,
    // exercising the isThisType read at schema-builder.ts's max-depth guard
    // (as opposed to the normal-depth path in buildSchemaInternal above).
    const code = `
export class Cls {
  add(item: string): this { return this; }
}
`;
    const result = await extract({ entryFile: 'test.ts', content: code, maxTypeDepth: 0 });
    const cls = result.spec.exports.find((e) => e.name === 'Cls');
    const method = cls?.members?.find((m) => m.name === 'add');
    const ret = method?.signatures?.[0]?.returns?.schema;
    // At the depth cap, the `this` type still resolves to a bare $ref (no
    // 'x-ts-type': 'this' marker — that marker is only added by the
    // normal-depth path in buildSchemaInternal, not buildMaxDepthSchema).
    expect(ret).toEqual({ $ref: '#/types/Cls' });
  });
});
