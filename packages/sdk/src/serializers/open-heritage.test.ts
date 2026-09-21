import { describe, expect, test } from 'bun:test';
import type { OpenPkg } from '@openpkg-ts/spec';
import { extract } from '../builder/spec-builder';

/** zustand devtools' shape: the base is an alias the checker resolves to `any`. */
const OPEN_BASES = `
import type { ExternalBase } from 'missing-pkg';
import { ExtClass } from 'missing-pkg';
declare const win: { ext?: never };
type Config = Parameters<(typeof win)['nope']['connect']>[1];
interface Known { known: string }

export interface DevtoolsOptions extends Config { name?: string; enabled?: boolean }
interface Hidden extends Known, ExternalBase { own: number }
interface Closed extends Known { own: number }
type AliasOptions = { a?: string } & Config;

export declare function devtools(o: DevtoolsOptions, h: Hidden, c: Closed, a: AliasOptions): void;
export class Store extends ExtClass { get(): number { return 1; } }
class Inner extends ExtClass { size = 1; }
export declare function inner(): Inner;
`;

async function specOf(code: string): Promise<OpenPkg> {
  return (await extract({ entryFile: 'test.ts', content: code })).spec;
}

const OWN = {
  type: 'object',
  properties: { name: { type: 'string' }, enabled: { type: 'boolean' } },
};

describe('heritage the checker cannot see into', () => {
  test('types[] interface records extends and stays open', async () => {
    const spec = await specOf(OPEN_BASES);
    const options = spec.types?.find((t) => t.id === 'DevtoolsOptions');

    expect(options?.extends).toBe('Config');
    expect(options?.schema).toEqual({ allOf: [OWN, { $ref: '#/types/Config' }] });
    expect(spec.types?.find((t) => t.id === 'Config')).toBeDefined();
  });

  test('exported interface schema stays open', async () => {
    const spec = await specOf(OPEN_BASES);
    const options = spec.exports.find((e) => e.name === 'DevtoolsOptions');

    expect(options?.extends).toBe('Config');
    expect(options?.schema).toEqual({ allOf: [OWN, { $ref: '#/types/Config' }] });
  });

  test('several bases: all recorded, only the unresolved one is an arm', async () => {
    const spec = await specOf(OPEN_BASES);
    const hidden = spec.types?.find((t) => t.id === 'Hidden');

    expect(hidden?.extends).toBe('Known & ExternalBase');
    expect(hidden?.schema).toEqual({
      allOf: [
        {
          type: 'object',
          properties: { own: { type: 'number' }, known: { type: 'string' } },
          required: ['own', 'known'],
        },
        { $ref: '#/types/ExternalBase' },
      ],
    });
    // The arm resolves: an unresolved import is registered by its written name
    expect(spec.types?.find((t) => t.id === 'ExternalBase')?.schema).toEqual({
      'x-ts-type': 'ExternalBase',
    });
  });

  test('resolvable base: extends recorded, flattened shape stays closed', async () => {
    const spec = await specOf(OPEN_BASES);
    const closed = spec.types?.find((t) => t.id === 'Closed');

    expect(closed?.extends).toBe('Known');
    expect(closed?.schema).toEqual({
      type: 'object',
      properties: { own: { type: 'number' }, known: { type: 'string' } },
      required: ['own', 'known'],
    });
  });

  test('classes: exported and registered', async () => {
    const spec = await specOf(OPEN_BASES);
    const store = spec.exports.find((e) => e.name === 'Store');
    const inner = spec.types?.find((t) => t.id === 'Inner');

    expect(store?.extends).toBe('ExtClass');
    // A value import has no type to register: text, not a dangling ref
    expect((store?.schema as { allOf?: unknown[] }).allOf?.[1]).toEqual({
      'x-ts-type': 'ExtClass',
    });
    expect(inner?.extends).toBe('ExtClass');
    expect((inner?.schema as { allOf?: unknown[] }).allOf?.[1]).toEqual({
      'x-ts-type': 'ExtClass',
    });
  });

  test('alias intersection with an unresolved arm is already open', async () => {
    const spec = await specOf(OPEN_BASES);
    const alias = spec.types?.find((t) => t.id === 'AliasOptions');

    expect(alias?.schema).toEqual({
      allOf: [
        { type: 'object', properties: { a: { type: 'string' } } },
        { $ref: '#/types/Config' },
      ],
    });
  });
});

/** zod's shape: `interface RegistryParams extends ToJSONSchemaParams`, where the base is an alias of a utility type. */
describe('a base that is an alias of an anonymous type', () => {
  test('extends names what the source wrote, and the base keys are inherited', async () => {
    const spec = await specOf(`
interface GeneratorParams { processors: string[]; target?: string; io?: 'input' | 'output' }
export type Params = Omit<GeneratorParams, 'processors'>;
export interface RegistryParams extends Params { uri?: (id: string) => string }
export declare function toJSON(registry: object, params?: RegistryParams): void;
`);
    const entry = [...(spec.types ?? []), ...spec.exports].find((t) => t.name === 'RegistryParams');
    expect(entry?.extends).toBe('Params');
    const schema = entry?.schema as { properties?: Record<string, unknown> } | undefined;
    expect(Object.keys(schema?.properties ?? {}).sort()).toEqual(['io', 'target', 'uri']);
  });
});
