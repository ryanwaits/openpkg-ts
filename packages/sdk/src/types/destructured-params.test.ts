import { describe, expect, test } from 'bun:test';
import type { SpecExport, SpecSignatureParameter } from '@openpkg-ts/spec';
import { extract } from '../builder/spec-builder';
import { formatParameters } from '../core/query';

/** Narrow to the first signature's parameters, failing the test if missing. */
function firstSignatureParams(fn: SpecExport | undefined): SpecSignatureParameter[] {
  const params = fn?.signatures?.[0]?.parameters;
  if (!params) throw new Error('expected export to have a signature with parameters');
  return params;
}

async function paramsOf(code: string, name: string) {
  const { spec } = await extract({ entryFile: 'test.ts', content: code });
  const fn = spec.exports.find((e) => e.name === name);
  return { fn, params: firstSignatureParams(fn) };
}

type Obj = Record<string, unknown>;

describe('destructured parameters are one parameter', () => {
  test('object pattern with a rename and an optional key', async () => {
    const code = `
export const wrap = ({ model: inputModel, middleware, modelId }: {
  model: string;
  middleware: string | string[];
  modelId?: string;
}): string => inputModel;
`;
    const { fn, params } = await paramsOf(code, 'wrap');

    expect(params).toHaveLength(1);
    const [p] = params;
    expect(p.name).toBe('options');
    expect(p.required).toBe(true);
    expect(p['x-ts-destructured']).toBe(true);

    const schema = p.schema as Obj;
    expect(schema.type).toBe('object');
    // Public names are the property names, never the local rename.
    expect(Object.keys(schema.properties as Obj).sort()).toEqual([
      'middleware',
      'model',
      'modelId',
    ]);
    expect(schema.required).toEqual(['model', 'middleware']);
    expect(JSON.stringify(schema)).not.toContain('inputModel');

    expect(formatParameters(fn?.signatures?.[0])).toBe(
      '(options: { model: string; middleware: string | string[]; modelId?: string })',
    );
  });

  test('array pattern', async () => {
    const code = `export function pair([first, second]: [string, number]): void {}`;
    const { params } = await paramsOf(code, 'pair');

    expect(params).toHaveLength(1);
    expect(params[0].name).toBe('args');
    expect(params[0].required).toBe(true);
    expect(params[0]['x-ts-destructured']).toBe(true);
    expect(params[0].schema).toMatchObject({
      type: 'array',
      prefixItems: [{ type: 'string' }, { type: 'number' }],
    });
  });

  test('pattern with `= {}` default is not required', async () => {
    const code = `export function run({ mode = 'dev', retries }: { mode?: string; retries?: number } = {}): void {}`;
    const { params } = await paramsOf(code, 'run');

    expect(params).toHaveLength(1);
    const [p] = params;
    expect(p.name).toBe('options');
    expect(p.required).toBe(false);
    expect(p.default).toBe('{}');
    expect(p['x-ts-destructured']).toBe(true);
    // Element defaults land on the property they default.
    const props = (p.schema as Obj).properties as Record<string, Obj>;
    expect(props.mode.default).toBe('dev');
    expect(props.retries.default).toBeUndefined();
  });

  test('named type keeps its $ref', async () => {
    const code = `
export interface Props { children?: string; roomId: string }
export function Provider({ children, roomId }: Props): string { return roomId; }
`;
    const { params } = await paramsOf(code, 'Provider');

    expect(params).toHaveLength(1);
    expect(params[0].name).toBe('options');
    expect(params[0].schema).toEqual({ $ref: '#/types/Props' });
    expect(params[0]['x-ts-destructured']).toBe(true);
  });

  test('@param names the pattern and documents its keys', async () => {
    const code = `
/**
 * Connects.
 * @param opts - Connection options.
 * @param opts.host - Host name.
 */
export function connect({ host, port }: { host: string; port?: number }): void {}
`;
    const { params } = await paramsOf(code, 'connect');

    expect(params).toHaveLength(1);
    const [p] = params;
    expect(p.name).toBe('opts');
    expect(p.description).toBe('Connection options.');
    const props = (p.schema as Obj).properties as Record<string, Obj>;
    expect(props.host.description).toBe('Host name.');
  });

  test('bare @param tags that document keys do not name the pattern', async () => {
    const code = `
/**
 * Embeds.
 * @param model - The model.
 * @param value - The value.
 */
export function embed({ model: modelArg, value }: { model: string; value: string }): void {}
`;
    const { params } = await paramsOf(code, 'embed');

    expect(params).toHaveLength(1);
    const [p] = params;
    expect(p.name).toBe('options');
    expect(p.description).toBeUndefined();
    const props = (p.schema as Obj).properties as Record<string, Obj>;
    expect(props.model.description).toBe('The model.');
    expect(props.value.description).toBe('The value.');
  });

  test('bare @param tags naming keys of an intersection type do not name the pattern', async () => {
    const code = `
export interface A { a: string }
/**
 * Runs.
 * @param a - Key a.
 * @param b - Key b.
 */
export function f({ a, ...rest }: A & { b: string }): void {}
`;
    const { params } = await paramsOf(code, 'f');

    expect(params).toHaveLength(1);
    expect(params[0].name).toBe('options');
    expect(params[0].description).toBeUndefined();
  });

  test('intersection type resolves to an object with every key', async () => {
    const code = `
export interface Base { a: string }
export function f({ a, b }: Base & { b: number }): void {}
`;
    const { fn, params } = await paramsOf(code, 'f');

    expect(params).toHaveLength(1);
    const [p] = params;
    expect(p.name).toBe('options');
    expect(p['x-ts-destructured']).toBe(true);
    const schema = p.schema as Obj;
    expect(schema.type).toBe('object');
    expect(Object.keys(schema.properties as Obj).sort()).toEqual(['a', 'b']);
    expect(schema.required).toEqual(['a', 'b']);
    // Signature text keeps the written form; consumers read properties/required.
    expect(schema['x-ts-type']).toBe('Base & { b: number; }');
    expect(formatParameters(fn?.signatures?.[0])).toBe('(options: Base & { b: number; })');
  });

  test('union of object types resolves to the keys of every arm', async () => {
    const code = `
export function f({ a }: { a: string; b?: number } | { a: string; c: string }): void {}
`;
    const { params } = await paramsOf(code, 'f');

    expect(params).toHaveLength(1);
    const schema = params[0].schema as Obj;
    expect(schema.type).toBe('object');
    expect(Object.keys(schema.properties as Obj).sort()).toEqual(['a', 'b', 'c']);
    // Required only when required in every arm.
    expect(schema.required).toEqual(['a']);
  });

  test('ordinary named parameter is unchanged', async () => {
    const code = `export function plain(options: { a: string }, b?: number): void {}`;
    const { params } = await paramsOf(code, 'plain');

    expect(params).toHaveLength(2);
    expect(params[0]).toEqual({
      name: 'options',
      required: true,
      schema: { type: 'object', properties: { a: { type: 'string' } }, required: ['a'] },
    });
    expect(params[0]['x-ts-destructured']).toBeUndefined();
    expect(params[1]).toMatchObject({ name: 'b', required: false });
  });

  test('function-typed property with a destructured parameter', async () => {
    const code = `export const handlers: { on: ({ id }: { id: string }) => void } = { on: () => {} };`;
    const { spec } = await extract({ entryFile: 'test.ts', content: code });
    const exp = spec.exports.find((e) => e.name === 'handlers');
    const on = (exp?.schema as Obj | undefined)?.properties as Record<string, Obj> | undefined;
    const sig = (
      on?.on?.['x-ts-signatures'] as Array<{ parameters: SpecSignatureParameter[] }>
    )?.[0];

    expect(sig?.parameters).toHaveLength(1);
    expect(sig?.parameters[0].name).toBe('options');
    expect(sig?.parameters[0]['x-ts-destructured']).toBe(true);
  });
});
