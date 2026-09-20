import { describe, expect, test } from 'bun:test';
import type { OpenPkg, SpecExport, SpecSchema } from '@openpkg-ts/spec';
import { normalize } from '@openpkg-ts/spec';
import { extract } from '../builder/spec-builder';
import { formatSchema } from '../core/query';
import { normalizeSchema } from './schema-normalizer';

const UNDEFINED = { type: 'null', 'x-ts-type': 'undefined' } as const;
const NULL = { type: 'null' } as const;

type Branch = { type?: string; 'x-ts-type'?: string };

function branchesOf(schema: unknown): Branch[] {
  const obj = schema as { anyOf?: Branch[] } | undefined;
  return obj?.anyOf ?? [];
}

function exportOf(spec: OpenPkg, name: string): SpecExport {
  const exp = spec.exports.find((e) => e.name === name);
  if (!exp) throw new Error(`missing export ${name}`);
  return exp;
}

function sigOf(spec: OpenPkg, name: string) {
  return exportOf(spec, name).signatures?.[0];
}

describe('undefined vs null fidelity', () => {
  test('normalizeSchema: undefined keeps x-ts-type, null does not', () => {
    expect(normalizeSchema({ type: 'undefined' })).toEqual(UNDEFINED);
    expect(normalizeSchema({ type: 'null' })).toEqual(NULL);
    expect(normalizeSchema({ type: 'void' })).toEqual({ type: 'null', 'x-ts-type': 'void' });
  });

  test('lively case: useLiveStateData<T>(): T | undefined is not T | null', async () => {
    const code = `
      export function useLiveStateData<T>(key: string): T | undefined {
        return undefined;
      }
    `;
    const { spec } = await extract({ entryFile: 'test.ts', content: code });
    const schema = sigOf(spec, 'useLiveStateData')?.returns?.schema;

    const branches = branchesOf(schema);
    expect(branches).toContainEqual(UNDEFINED);
    expect(branches).toContainEqual({ 'x-ts-type': 'T' });
    expect(branches).toHaveLength(2);
    expect(branches).not.toContainEqual(NULL);

    const formatted = formatSchema(schema);
    expect(formatted).toContain('undefined');
    expect(formatted).not.toMatch(/\bnull\b/);

    const again = normalize(spec);
    expect(sigOf(again, 'useLiveStateData')?.returns?.schema).toEqual(schema);
  });

  test('T | null, T | undefined, T | null | undefined, optional prop all differ', async () => {
    const code = `
      export function asNull<T>(v: T | null): T | null { return v; }
      export function asUndef<T>(v: T | undefined): T | undefined { return v; }
      export function asBoth<T>(v: T | null | undefined): T | null | undefined { return v; }
      export interface OptionalBox<T> { value?: T }
      export interface UndefBox<T> { value: T | undefined }
      export interface NullBox<T> { value: T | null }
    `;
    const { spec } = await extract({ entryFile: 'test.ts', content: code });

    const nullFn = sigOf(spec, 'asNull');
    const undefFn = sigOf(spec, 'asUndef');
    const bothFn = sigOf(spec, 'asBoth');

    for (const schema of [nullFn?.parameters?.[0]?.schema, nullFn?.returns?.schema]) {
      const branches = branchesOf(schema);
      expect(branches).toContainEqual(NULL);
      expect(branches).toContainEqual({ 'x-ts-type': 'T' });
      expect(branches).not.toContainEqual(UNDEFINED);
      expect(branches).toHaveLength(2);
    }

    for (const schema of [undefFn?.parameters?.[0]?.schema, undefFn?.returns?.schema]) {
      const branches = branchesOf(schema);
      expect(branches).toContainEqual(UNDEFINED);
      expect(branches).toContainEqual({ 'x-ts-type': 'T' });
      expect(branches).not.toContainEqual(NULL);
      expect(branches).toHaveLength(2);
    }

    for (const schema of [bothFn?.parameters?.[0]?.schema, bothFn?.returns?.schema]) {
      const branches = branchesOf(schema);
      expect(branches).toContainEqual(NULL);
      expect(branches).toContainEqual(UNDEFINED);
      expect(branches).toContainEqual({ 'x-ts-type': 'T' });
      expect(branches).toHaveLength(3);
    }

    expect(nullFn?.returns?.schema).not.toEqual(undefFn?.returns?.schema);
    expect(nullFn?.returns?.schema).not.toEqual(bothFn?.returns?.schema);
    expect(undefFn?.returns?.schema).not.toEqual(bothFn?.returns?.schema);

    const props = (name: string) => {
      const schema = exportOf(spec, name).schema as {
        properties?: Record<string, SpecSchema>;
        required?: string[];
      };
      return { schema: schema?.properties?.value, required: schema?.required ?? [] };
    };

    const optional = props('OptionalBox');
    const undef = props('UndefBox');
    const nullable = props('NullBox');

    expect(optional.schema).toEqual({ 'x-ts-type': 'T' });
    expect(optional.required).not.toContain('value');

    expect(branchesOf(undef.schema)).toContainEqual(UNDEFINED);
    expect(branchesOf(undef.schema)).toContainEqual({ 'x-ts-type': 'T' });
    expect(branchesOf(undef.schema)).not.toContainEqual(NULL);
    expect(undef.required).toContain('value');

    expect(branchesOf(nullable.schema)).toContainEqual(NULL);
    expect(branchesOf(nullable.schema)).not.toContainEqual(UNDEFINED);
    expect(nullable.required).toContain('value');

    expect(optional.schema).not.toEqual(undef.schema);
    expect(undef.schema).not.toEqual(nullable.schema);
    expect(optional.schema).not.toEqual(nullable.schema);
  });

  test('generic default T = undefined is checker text, not a schema', async () => {
    const code = `export function withDefault<T = undefined>(v: T): T { return v; }`;
    const { spec } = await extract({ entryFile: 'test.ts', content: code });
    expect(exportOf(spec, 'withDefault').typeParameters?.[0]).toEqual({
      name: 'T',
      default: 'undefined',
    });
  });
});
