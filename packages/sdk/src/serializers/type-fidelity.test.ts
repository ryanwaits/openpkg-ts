import { describe, expect, test } from 'bun:test';
import type { SpecSchema } from '@openpkg-ts/spec';
import { extract } from '../builder/spec-builder';
import { scrubImportQualifiers } from '../types/schema-builder';

/** Four lossy property shapes: union-of-ref, boolean-union, function-typed, literal-union. */
const LOSSY_SHAPES = `
/** A callback invoked per event. */
export type Handler = (event: string) => void;

/** Fine-grained capture configuration. */
export interface Config {
  /** Retry count. */
  retries?: number;
}

/** Options controlling the client. */
export type Options = {
  /** One handler or many. */
  send?: Handler | Handler[];
  /** Toggle, or fine-grained config. */
  capture: boolean | Config;
  /** Ready callback. */
  loaded?: (c: Config) => void;
  /** Mode selection. */
  mode: 'auto' | 'manual';
  /** Plain string. */
  label: string;
};
`;

const ALIAS_FORMS = `
interface Base {
  /** Documented base field. */
  a: string;
  /** Another field. */
  b?: number;
}

interface Extra {
  /** Extra field. */
  c: boolean;
}

/** Intersection alias — object-shaped, should carry members. */
export type Merged = Base & Extra;

/** Mapped/utility alias — object-shaped, should carry members. */
export type Chosen = Pick<Base, 'a'>;
`;

const DECLARATION_FORMS = `
interface BaseApi {
  /** Method-syntax on the base. Omit-mapping strips SymbolFlags.Method. */
  run(): void;
  /** Also method-syntax on the base — mapped, so flag stripped. */
  jog(pace: number): void;
  /** Function-typed property. */
  walk: () => void;
  /** Plain data. */
  speed: number;
}

/** Alias mixing Omit-mapped members with a method-syntax re-declaration. */
export type Api = Omit<BaseApi, 'run'> & {
  /** Re-declared with method syntax — a true method member. */
  run(cmd: string): void;
};
`;

const MEMBER_ORDER = `
interface BaseConfig {
  /** Instance name — declared FIRST in the base. */
  name?: string;
  /** API host. */
  api_host?: string;
  /** UI host. */
  ui_host?: string;
  /** Ready callback (to be overridden). */
  loaded?: () => void;
  /** Token. */
  token?: string;
}

/** Intersection over an Omit-mapped base. */
export type Config = Omit<BaseConfig, 'loaded'> & {
  /** Overriding ready callback. */
  loaded?: (ready: boolean) => void;
  /** New in this layer. */
  debug_mode?: boolean;
};
`;

const ALIAS_LEVEL_TEXT = `
/** An item. */
export interface Item { n: number; }
/** Array alias. */
export type ItemList = Item[];
/** Generic holder. */
export interface Holder<A, B> { a: A; b: B; }
/** Instantiation alias. */
export type Pair = Holder<string, Item>;
/** Readonly-carrying interface. */
export interface Locked { readonly id: string; }
/** Mapped view keeps the readonly modifier. */
export type LockedView = Pick<Locked, 'id'>;
`;

function schemaOf(value: unknown): Record<string, unknown> {
  return (value ?? {}) as Record<string, unknown>;
}

describe('x-ts-type on property and member schemas', () => {
  test('registry schema.properties carry checker-rendered type text', async () => {
    const result = await extract({ entryFile: 'test.ts', content: LOSSY_SHAPES });
    const options = result.spec.types?.find((t) => t.name === 'Options');
    const props = schemaOf(options?.schema).properties as Record<string, Record<string, unknown>>;

    expect(props.send['x-ts-type']).toBe('Handler | Handler[]');
    expect(props.capture['x-ts-type']).toBe('boolean | Config');
    expect(props.loaded['x-ts-type']).toBe('(c: Config) => void');
    expect(props.mode['x-ts-type']).toBe('"auto" | "manual"');
    // Policy: bare primitive keywords are derivable from the schema — no text
    expect(props.label['x-ts-type']).toBeUndefined();
  });

  test('export members[].schema carry the same type text plus docs', async () => {
    const result = await extract({ entryFile: 'test.ts', content: LOSSY_SHAPES });
    const options = result.spec.exports.find((e) => e.name === 'Options');
    const members = options?.members ?? [];

    const byName = new Map(members.map((m) => [m.name, m]));
    expect(schemaOf(byName.get('send')?.schema)['x-ts-type']).toBe('Handler | Handler[]');
    expect(schemaOf(byName.get('capture')?.schema)['x-ts-type']).toBe('boolean | Config');
    expect(schemaOf(byName.get('loaded')?.schema)['x-ts-type']).toBe('(c: Config) => void');
    expect(schemaOf(byName.get('mode')?.schema)['x-ts-type']).toBe('"auto" | "manual"');
    expect(byName.get('send')?.description).toBe('One handler or many.');
    expect(byName.get('send')?.flags?.optional).toBe(true);
  });

  test('optional props render without | undefined', async () => {
    const result = await extract({ entryFile: 'test.ts', content: LOSSY_SHAPES });
    const options = result.spec.types?.find((t) => t.name === 'Options');
    const props = schemaOf(options?.schema).properties as Record<string, Record<string, unknown>>;
    expect(props.send['x-ts-type']).not.toContain('undefined');
    expect(props.loaded['x-ts-type']).not.toContain('undefined');
  });

  test('no machine-specific import() qualifiers anywhere in the spec', async () => {
    for (const content of [LOSSY_SHAPES, ALIAS_FORMS, DECLARATION_FORMS, ALIAS_LEVEL_TEXT]) {
      const result = await extract({ entryFile: 'test.ts', content });
      expect(JSON.stringify(result.spec)).not.toContain('import("');
    }
  });
});

describe('scrubImportQualifiers', () => {
  test('strips absolute-path import qualifiers', () => {
    expect(scrubImportQualifiers('import("/abs/path/node_modules/pkg/dist/index").Config')).toBe(
      'Config',
    );
    expect(scrubImportQualifiers('Map<string, import("/some/where/types").Item[]> | null')).toBe(
      'Map<string, Item[]> | null',
    );
    expect(scrubImportQualifiers("import('/single/quote/mod').Foo")).toBe('Foo');
  });

  test('leaves text without qualifiers untouched', () => {
    expect(scrubImportQualifiers('Handler | Handler[]')).toBe('Handler | Handler[]');
    expect(scrubImportQualifiers('"auto" | "manual"')).toBe('"auto" | "manual"');
  });
});

describe('alias-level x-ts-type and schema shape', () => {
  test('array alias gets a real array schema and renderable text', async () => {
    const result = await extract({ entryFile: 'test.ts', content: ALIAS_LEVEL_TEXT });
    const itemList = result.spec.types?.find((t) => t.name === 'ItemList');
    const schema = schemaOf(itemList?.schema);
    expect(schema.type).toBe('array');
    expect(schemaOf(schema.items).$ref).toBe('#/types/Item');
    expect(schema['x-ts-type']).toBe('Item[]');

    const exp = result.spec.exports.find((e) => e.name === 'ItemList');
    expect(schemaOf(exp?.schema)['x-ts-type']).toBe('Item[]');
  });

  test('instantiation alias gets renderable text', async () => {
    const result = await extract({ entryFile: 'test.ts', content: ALIAS_LEVEL_TEXT });
    const pair = result.spec.exports.find((e) => e.name === 'Pair');
    expect(schemaOf(pair?.schema)['x-ts-type']).toBe('Holder<string, Item>');
  });

  test('readonly surfaces as readOnly on the schema layer', async () => {
    const result = await extract({ entryFile: 'test.ts', content: ALIAS_LEVEL_TEXT });
    // Interface export: schema is regenerated from members, readOnly mirrors flags.readonly
    const locked = result.spec.exports.find((e) => e.name === 'Locked');
    const lockedProps = schemaOf(locked?.schema).properties as Record<
      string,
      Record<string, unknown>
    >;
    expect(lockedProps.id.readOnly).toBe(true);

    // Registry-only path: the mapped view keeps readOnly on schema.properties
    const viewType = result.spec.types?.find((t) => t.name === 'LockedView');
    const viewProps = schemaOf(viewType?.schema).properties as Record<
      string,
      Record<string, unknown>
    >;
    expect(viewProps.id.readOnly).toBe(true);

    const view = result.spec.exports.find((e) => e.name === 'LockedView');
    const idMember = view?.members?.find((m) => m.name === 'id');
    expect(idMember?.flags?.readonly).toBe(true);
    expect(schemaOf(idMember?.schema).readOnly).toBe(true);
  });
});

describe('members[] for object-shaped alias forms', () => {
  test('intersection alias keeps members (unchanged path)', async () => {
    const result = await extract({ entryFile: 'test.ts', content: ALIAS_FORMS });
    const merged = result.spec.exports.find((e) => e.name === 'Merged');
    const names = merged?.members?.map((m) => m.name);
    expect(names).toEqual(['a', 'b', 'c']);
    expect(merged?.members?.[0]?.description).toBe('Documented base field.');
  });

  test('Pick-derived alias carries members with base docs', async () => {
    const result = await extract({ entryFile: 'test.ts', content: ALIAS_FORMS });
    const chosen = result.spec.exports.find((e) => e.name === 'Chosen');
    expect(chosen?.members?.map((m) => m.name)).toEqual(['a']);
    expect(chosen?.members?.[0]?.description).toBe('Documented base field.');
  });

  test('object-literal alias carries members with docs and flags', async () => {
    const result = await extract({ entryFile: 'test.ts', content: LOSSY_SHAPES });
    const options = result.spec.exports.find((e) => e.name === 'Options');
    expect(options?.members?.map((m) => m.name)).toEqual([
      'send',
      'capture',
      'loaded',
      'mode',
      'label',
    ]);
  });

  test('builtin instantiations do not leak prototype members', async () => {
    const result = await extract({
      entryFile: 'test.ts',
      content: `export type Deferred = Promise<string>;`,
    });
    const deferred = result.spec.exports.find((e) => e.name === 'Deferred');
    expect(deferred?.members).toBeUndefined();
  });
});

describe('declaration form (method syntax vs function-typed property)', () => {
  test('method-syntax re-declaration is marked, mapped members are not', async () => {
    const result = await extract({ entryFile: 'test.ts', content: DECLARATION_FORMS });
    const api = result.spec.exports.find((e) => e.name === 'Api');
    const byName = new Map(api?.members?.map((m) => [m.name, m]));

    expect(byName.get('run')?.kind).toBe('method');
    expect(byName.get('run')?.flags?.methodSyntax).toBe(true);
    // Omit-mapped members lose SymbolFlags.Method — no marker
    expect(byName.get('jog')?.kind).toBe('method');
    expect(byName.get('jog')?.flags?.methodSyntax).toBeUndefined();
    expect(byName.get('walk')?.kind).toBe('property');
    expect(byName.get('walk')?.flags?.methodSyntax).toBeUndefined();
    expect(byName.get('speed')?.kind).toBe('property');
  });

  test('x-ts-method mirrors the marker on schema-layer function props', async () => {
    const result = await extract({ entryFile: 'test.ts', content: DECLARATION_FORMS });
    const api = result.spec.types?.find((t) => t.name === 'Api');
    const props = schemaOf(api?.schema).properties as Record<string, Record<string, unknown>>;

    expect(props.run['x-ts-method']).toBe(true);
    expect(props.jog['x-ts-method']).toBeUndefined();
    expect(props.walk['x-ts-method']).toBeUndefined();
  });

  test('interface method members carry methodSyntax', async () => {
    const result = await extract({
      entryFile: 'test.ts',
      content: `export interface Api { run(cmd: string): void; walk: () => void; }`,
    });
    const api = result.spec.exports.find((e) => e.name === 'Api');
    const run = api?.members?.find((m) => m.name === 'run');
    const walk = api?.members?.find((m) => m.name === 'walk');
    expect(run?.flags?.methodSyntax).toBe(true);
    expect(walk?.flags?.methodSyntax).toBeUndefined();
  });
});

describe('member order regression — declaration order preserved', () => {
  // The checker's own property order for Omit-mapped intersections can deviate
  // (type-interning artifact); openpkg intentionally preserves declaration order.
  test('intersection over Omit-mapped base keeps base declaration order', async () => {
    const result = await extract({ entryFile: 'test.ts', content: MEMBER_ORDER });
    const config = result.spec.exports.find((e) => e.name === 'Config');
    expect(config?.members?.map((m) => m.name)).toEqual([
      'name',
      'api_host',
      'ui_host',
      'token',
      'loaded',
      'debug_mode',
    ]);
  });
});

// Type-level sanity: x-ts-method is part of the published extension surface.
const _schemaWithMethod: SpecSchema = { 'x-ts-function': true, 'x-ts-method': true };
void _schemaWithMethod;
