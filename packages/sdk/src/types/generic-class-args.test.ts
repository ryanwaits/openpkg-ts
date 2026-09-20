import { describe, expect, test } from 'bun:test';
import type { OpenPkg, SpecExport, SpecSchema } from '@openpkg-ts/spec';
import { extract } from '../builder/spec-builder';
import { normalizeSchema } from './schema-normalizer';

type SchemaObj = Record<string, unknown>;

function exportOf(spec: OpenPkg, name: string): SpecExport {
  const exp = spec.exports.find((e) => e.name === name);
  if (!exp) throw new Error(`missing export ${name}`);
  return exp;
}

function retSchema(spec: OpenPkg, name: string): SchemaObj | undefined {
  return exportOf(spec, name).signatures?.[0]?.returns?.schema as SchemaObj | undefined;
}

function paramSchema(spec: OpenPkg, name: string): SchemaObj | undefined {
  return exportOf(spec, name).signatures?.[0]?.parameters?.[0]?.schema as SchemaObj | undefined;
}

const BOX = `
  export class Box<K, V> {
    get(_k: K): V | undefined { return undefined; }
  }
  export function useBox<V>(key: string): Box<string, V> { return new Box(); }
  export function useBoxNull<V>(key: string): Box<string, V> | null { return null; }
  export function takeBox<V>(m: Box<string, V>): void {}
  export interface Holder<V> { map: Box<string, V> }
`;

const LIVELY = `
  export class LiveMap<V = unknown> {
    get(_k: string): V | undefined { return undefined; }
  }
  export class LiveList<T = unknown> {
    get(_i: number): T | undefined { return undefined; }
  }
  export function useMapSuspense<V>(key: string): LiveMap<string, V> {
    return new LiveMap();
  }
  export function useMap<V>(key: string): LiveMap<string, V> | null {
    return null;
  }
  export function takeMap<V>(m: LiveMap<string, V>): void {}
  export interface MapHolder<V> { map: LiveMap<string, V> }
  export function useListSuspense<T>(key: string): LiveList<T> {
    return new LiveList();
  }
`;

describe('generic class instantiations', () => {
  test('Box<string, V> return, | null, param, and property keep $ref + type args', async () => {
    const { spec } = await extract({ entryFile: 'test.ts', content: BOX });
    const expected = {
      $ref: '#/types/Box',
      'x-ts-type-arguments': [{ type: 'string' }, { 'x-ts-type': 'V' }],
    };

    expect(retSchema(spec, 'useBox')).toMatchObject(expected);

    const nullable = retSchema(spec, 'useBoxNull');
    expect(nullable?.anyOf).toContainEqual({ type: 'null' });
    expect(nullable?.anyOf).toContainEqual(expected);

    expect(paramSchema(spec, 'takeBox')).toMatchObject(expected);

    const holder = exportOf(spec, 'Holder').schema as {
      properties?: Record<string, SchemaObj>;
    };
    expect(holder.properties?.map).toMatchObject(expected);
  });

  test('LiveMap<V> written as LiveMap<string, V> is not a silent empty schema', async () => {
    const { spec } = await extract({ entryFile: 'test.ts', content: LIVELY });

    const suspense = retSchema(spec, 'useMapSuspense');
    expect(suspense).not.toEqual({});
    expect(suspense).toMatchObject({
      $ref: '#/types/LiveMap',
      'x-ts-type-arguments': [{ type: 'string' }, { 'x-ts-type': 'V' }],
    });

    const nullable = retSchema(spec, 'useMap');
    expect(nullable).not.toEqual({});
    expect(nullable?.anyOf).toContainEqual({ type: 'null' });
    expect(nullable?.anyOf).toContainEqual({
      $ref: '#/types/LiveMap',
      'x-ts-type-arguments': [{ type: 'string' }, { 'x-ts-type': 'V' }],
    });

    expect(paramSchema(spec, 'takeMap')).toMatchObject({
      $ref: '#/types/LiveMap',
      'x-ts-type-arguments': [{ type: 'string' }, { 'x-ts-type': 'V' }],
    });

    const holder = exportOf(spec, 'MapHolder').schema as {
      properties?: Record<string, SchemaObj>;
    };
    expect(holder.properties?.map).toMatchObject({
      $ref: '#/types/LiveMap',
      'x-ts-type-arguments': [{ type: 'string' }, { 'x-ts-type': 'V' }],
    });

    expect(retSchema(spec, 'useListSuspense')).toMatchObject({
      $ref: '#/types/LiveList',
      'x-ts-type-arguments': [{ 'x-ts-type': 'T' }],
    });
  });

  test('normalizeSchema(any) is not a silent {}', () => {
    expect(normalizeSchema({ type: 'any' } as SpecSchema)).toEqual({ 'x-ts-type': 'any' });
  });

  test('authored any return is x-ts-type any, not {}', async () => {
    const { spec } = await extract({
      entryFile: 'test.ts',
      content: 'export function f(): any { return 1; }',
    });
    expect(retSchema(spec, 'f')).toEqual({ 'x-ts-type': 'any' });
  });
});
