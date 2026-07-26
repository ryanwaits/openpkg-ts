import { describe, expect, test } from 'bun:test';
import { extract } from '../builder/spec-builder';

const schemaOf = (value: unknown): Record<string, unknown> =>
  (value ?? {}) as Record<string, unknown>;

describe('template literal lowering', () => {
  test('inline template literal → string with anchored pattern', async () => {
    const code = `export function on(event: \`on\${string}\`) {}`;
    const { spec } = await extract({ entryFile: 'test.ts', content: code });
    const param = schemaOf(
      spec.exports.find((e) => e.name === 'on')?.signatures?.[0]?.parameters?.[0]?.schema,
    );
    expect(param.type).toBe('string');
    expect(param.pattern).toBe('^on.*$');
    // biome-ignore lint/suspicious/noTemplateCurlyInString: asserting the rendered TS template-literal type name
    expect(param['x-ts-type']).toBe('`on${string}`');
  });

  test('multi-slot template escapes literal spans', async () => {
    const code = `export function ver(v: \`v\${number}.\${number}\`) {}`;
    const { spec } = await extract({ entryFile: 'test.ts', content: code });
    const param = schemaOf(
      spec.exports.find((e) => e.name === 'ver')?.signatures?.[0]?.parameters?.[0]?.schema,
    );
    expect(param.pattern).toBe('^v-?\\d+(?:\\.\\d+)?\\.-?\\d+(?:\\.\\d+)?$');
  });
});

describe('optional property honesty (no spurious null)', () => {
  test('optional prop drops undefined branch, stays out of required', async () => {
    const code = `export interface Person { name: string; age?: number; }`;
    const { spec } = await extract({ entryFile: 'test.ts', content: code });
    const person = spec.exports.find((t) => t.name === 'Person');
    const props = schemaOf(schemaOf(person?.schema).properties);
    expect(props.age).toEqual({ type: 'number' });
    expect(schemaOf(person?.schema).required).toEqual(['name']);
  });

  test('optional boolean prop is a plain boolean, not a 3-branch anyOf', async () => {
    const code = `export interface Opts { includeDocsOnly?: boolean; }`;
    const { spec } = await extract({ entryFile: 'test.ts', content: code });
    const opts = spec.exports.find((t) => t.name === 'Opts');
    const props = schemaOf(schemaOf(opts?.schema).properties);
    expect(props.includeDocsOnly).toEqual({ type: 'boolean' });
  });

  test('explicit null in optional prop union survives', async () => {
    const code = `export interface Cfg { host?: string | null; }`;
    const { spec } = await extract({ entryFile: 'test.ts', content: code });
    const cfg = spec.exports.find((t) => t.name === 'Cfg');
    const props = schemaOf(schemaOf(cfg?.schema).properties);
    const branches = (schemaOf(props.host).anyOf ?? []) as Record<string, unknown>[];
    expect(branches).toContainEqual({ type: 'null' });
    expect(branches).toContainEqual({ type: 'string' });
    expect(branches).toHaveLength(2);
  });

  test('boolean | string union prop collapses literal pair', async () => {
    const code = `export interface Cfg { capture: boolean | string; }`;
    const { spec } = await extract({ entryFile: 'test.ts', content: code });
    const cfg = spec.exports.find((t) => t.name === 'Cfg');
    const props = schemaOf(schemaOf(cfg?.schema).properties);
    const branches = (schemaOf(props.capture).anyOf ?? []) as Record<string, unknown>[];
    expect(branches).toHaveLength(2);
    expect(branches).toContainEqual({ type: 'boolean' });
    expect(branches).toContainEqual({ type: 'string' });
  });

  test('optional members on a type alias drop the null branch', async () => {
    const code = `export type Options = {
  type: 'a' | 'b';
  network?: 'mainnet' | 'testnet';
  count?: number;
};`;
    const { spec } = await extract({ entryFile: 'test.ts', content: code });
    const opts = spec.exports.find((e) => e.name === 'Options');
    const members = opts?.members ?? [];
    const network = members.find((m) => m.name === 'network');
    const count = members.find((m) => m.name === 'count');
    // optional → flags.optional set, but schema must not admit null
    expect(count?.flags?.optional).toBe(true);
    expect(count?.schema).toEqual({ type: 'number' });
    expect(JSON.stringify(network?.schema)).not.toContain('null');
  });

  test('optional param of function-typed property strips undefined', async () => {
    const code = `export interface Api { join: (separator?: string) => string; }`;
    const { spec } = await extract({ entryFile: 'test.ts', content: code });
    const api = spec.exports.find((t) => t.name === 'Api');
    const props = schemaOf(schemaOf(api?.schema).properties);
    const signatures = schemaOf(props.join)['x-ts-signatures'] as Array<{
      parameters?: Array<{ schema: unknown; required?: boolean }>;
    }>;
    const sep = signatures?.[0]?.parameters?.[0];
    expect(sep?.required).toBe(false);
    expect(sep?.schema).toEqual({ type: 'string' });
  });
});

describe('conditional alias containment', () => {
  test('generic conditional alias bails to x-ts-type, no prototype explosion', async () => {
    const code = `export type Cond<T> = T extends string ? 'str' : 'other';`;
    const { spec } = await extract({ entryFile: 'test.ts', content: code });
    const cond = spec.exports.find((e) => e.name === 'Cond');
    const schema = schemaOf(cond?.schema);
    expect(schema.properties).toBeUndefined();
    expect(JSON.stringify(spec)).not.toContain('charAt');
    expect(String(schema['x-ts-type'] ?? cond?.type ?? '')).toContain('extends');
  });

  test('resolved non-generic conditional alias still flattens', async () => {
    const code = `export type C = 'a' extends string ? { x: number } : never;`;
    const { spec } = await extract({ entryFile: 'test.ts', content: code });
    const c = spec.exports.find((e) => e.name === 'C');
    const props = schemaOf(schemaOf(c?.schema).properties);
    expect(props.x).toEqual({ type: 'number' });
  });
});

describe('number index signatures', () => {
  test('number-keyed dictionary → patternProperties over digit keys', async () => {
    const code = `export interface NumDict { [key: number]: string; }`;
    const { spec } = await extract({ entryFile: 'test.ts', content: code });
    const dict = spec.exports.find((t) => t.name === 'NumDict');
    const schema = schemaOf(dict?.schema);
    expect(schema.patternProperties).toEqual({ '^\\d+$': { type: 'string' } });
    expect(schema['x-ts-index-key']).toBe('number');
    expect(schema['x-ts-type']).toBeUndefined();
  });

  test('mixed string and number index signatures coexist', async () => {
    const code = `export interface Mixed { [key: string]: unknown; [idx: number]: string; }`;
    const { spec } = await extract({ entryFile: 'test.ts', content: code });
    const mixed = spec.exports.find((t) => t.name === 'Mixed');
    const schema = schemaOf(mixed?.schema);
    expect(schema.additionalProperties).toBeDefined();
    expect(schemaOf(schema.patternProperties)['^\\d+$']).toEqual({ type: 'string' });
  });
});
