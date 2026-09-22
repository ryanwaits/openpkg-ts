import { describe, expect, test } from 'bun:test';
import type { SpecExport } from '@openpkg-ts/spec';
import { extract } from '../builder/spec-builder';

const WASM_PROXY_PATTERN = `
export declare class SDK {
  readonly deployer: string;
  runSnippet(snippet: string): string;
  execute(snippet: string): string;
  getContractSource(contract: string): string | undefined;
  callPublicFn(args: object): object;
}
export type CallFn = (fn: string, args: string[], sender: string) => { result: string };
/** @deprecated use \`simnet.execute(command)\` instead */
type RunSnippet = SDK["runSnippet"];
export type Simnet = {
  [K in keyof SDK]: K extends "runSnippet" ? RunSnippet : K extends "callPublicFn" ? CallFn : SDK[K];
};
`;

describe('type alias serialization — mapped/conditional and function aliases', () => {
  test('mapped type alias over class keys flattens into members', async () => {
    const result = await extract({ entryFile: 'test.ts', content: WASM_PROXY_PATTERN });
    const simnet = result.spec.exports.find((e) => e.name === 'Simnet');
    expect(simnet).toBeDefined();
    const members = simnet?.members ?? [];
    expect(members.map((m) => m.name).sort()).toEqual([
      'callPublicFn',
      'deployer',
      'execute',
      'getContractSource',
      'runSnippet',
    ]);

    const deployer = members.find((m) => m.name === 'deployer');
    expect(deployer?.kind).toBe('property');

    const execute = members.find((m) => m.name === 'execute');
    expect(execute?.kind).toBe('method');
    expect(execute?.signatures?.[0]?.parameters?.[0]?.name).toBe('snippet');
  });

  test('@deprecated on the conditional arm alias carries to the member', async () => {
    const result = await extract({ entryFile: 'test.ts', content: WASM_PROXY_PATTERN });
    const simnet = result.spec.exports.find((e) => e.name === 'Simnet');
    const runSnippet = simnet?.members?.find((m) => m.name === 'runSnippet');
    expect(runSnippet?.deprecated).toBe(true);
    expect(runSnippet?.deprecationReason).toContain('simnet.execute');

    const execute = simnet?.members?.find((m) => m.name === 'execute');
    expect(execute?.deprecated).toBeUndefined();
  });

  test('intersection alias flattens into members with per-property docs', async () => {
    const code = `
      interface Base {
        /** Called on load */
        loaded: (config: Base) => void;
        /** API host */
        api_host?: string;
        /** @deprecated use api_host */
        _legacy_host?: string;
      }
      export type Config = Omit<Base, 'loaded'> & {
        /** New loaded signature */
        loaded: (name: string) => boolean;
        extra?: boolean;
      };
    `;
    const result = await extract({ entryFile: 'test.ts', content: code });
    const config = result.spec.exports.find((e) => e.name === 'Config');
    expect(config).toBeDefined();
    // Schema keeps the intersection structure
    expect((config?.schema as { allOf?: unknown[] })?.allOf?.length).toBe(2);
    // Members carry the resolved surface
    const members = config?.members ?? [];
    expect(members.map((m) => m.name).sort()).toEqual([
      '_legacy_host',
      'api_host',
      'extra',
      'loaded',
    ]);
    const loaded = members.find((m) => m.name === 'loaded');
    // Declared as a property with function type — stays a property (matching
    // serializeInterface), carrying the literal's signature in its schema
    expect(loaded?.kind).toBe('property');
    expect(JSON.stringify(loaded?.schema)).toContain('"name"');
    expect(loaded?.description).toBe('New loaded signature');
    const apiHost = members.find((m) => m.name === 'api_host');
    expect(apiHost?.description).toBe('API host');
    const legacy = members.find((m) => m.name === '_legacy_host');
    expect(legacy?.deprecated).toBe(true);
  });

  test('intersection alias with call signatures keeps schema-only form', async () => {
    const code = `
      export type CallableThing = ((x: number) => string) & { cached?: boolean };
    `;
    const result = await extract({ entryFile: 'test.ts', content: code });
    const callable = result.spec.exports.find((e) => e.name === 'CallableThing');
    expect(callable).toBeDefined();
    expect(callable?.members).toBeUndefined();
  });

  test('function type alias gets signatures instead of opaque self-ref', async () => {
    const result = await extract({ entryFile: 'test.ts', content: WASM_PROXY_PATTERN });
    const callFn = result.spec.exports.find((e) => e.name === 'CallFn');
    expect(callFn).toBeDefined();
    const schema = callFn?.schema as Record<string, unknown>;
    expect(schema.$ref).toBeUndefined();
    const sigs = (schema['x-ts-signatures'] ?? schema.signatures) as Array<{
      parameters?: Array<{ name: string }>;
    }>;
    expect(sigs?.[0]?.parameters?.map((p) => p.name)).toEqual(['fn', 'args', 'sender']);
  });

  test('union with undefined in a method return survives through mapped members', async () => {
    const result = await extract({ entryFile: 'test.ts', content: WASM_PROXY_PATTERN });
    const simnet = result.spec.exports.find((e) => e.name === 'Simnet');
    const method = simnet?.members?.find((m) => m.name === 'getContractSource');
    const ret = JSON.stringify(method?.signatures?.[0]?.returns?.schema ?? {});
    // `string | undefined` must not collapse to bare string (undefined normalizes to null)
    expect(ret).toContain('string');
    expect(ret).toContain('null');
  });

  test('plain object and union aliases are unchanged', async () => {
    const result = await extract({
      entryFile: 'test.ts',
      content: `
export type Point = { x: number; y: number };
export type Status = 'open' | 'closed';
export interface Named { name: string }
export type AliasToNamed = Named;
`,
    });
    // Established design: exports carry a self-$ref, the real schema lives in types[]
    const point = result.spec.exports.find((e) => e.name === 'Point');
    expect(JSON.stringify(point?.schema)).toContain('Point');
    const pointType = result.spec.types?.find((t) => t.name === 'Point');
    expect(((pointType?.schema ?? {}) as Record<string, unknown>).properties).toBeDefined();
    const alias = result.spec.exports.find((e) => e.name === 'AliasToNamed');
    expect(JSON.stringify(alias?.schema)).toContain('Named');
    // Object-literal aliases now carry the members layer too
    expect(point?.members?.map((m) => m.name)).toEqual(['x', 'y']);
  });
});

// vercel/ai shape: `InferAgentUIMessage<AGENT> = UIMessage<…>` was emitted
// with UIMessage's id/role/metadata/parts as its OWN members, so doc-coverage
// tools reported "InferAgentUIMessage.parts is never documented".
const REFERENCE_ALIASES = `
export interface UIMessage<METADATA = unknown, DATA = unknown, TOOLS = unknown> {
  /** Message id */
  id: string;
  role: 'user' | 'assistant';
  metadata?: METADATA;
  parts: Array<DATA | TOOLS>;
}
export type InferUITools<T> = T extends { tools: infer TOOLS } ? TOOLS : never;
export type InferAgentUIMessage<AGENT, MESSAGE_METADATA = unknown> = UIMessage<
  MESSAGE_METADATA,
  never,
  InferUITools<AGENT>
>;
export type ConcreteMessage = UIMessage<string, number, boolean>;
export interface Named { name: string; age?: number }
export type AliasToNamed = Named;
export type CondToNamed = true extends true ? Named : never;
export type Lit = { a: string };
export type AliasToLit = Lit;
export type Picked = Pick<Named, 'name'>;
export type Mapped = { [K in keyof Named]: string };
export type WithExtra = Named & { extra: boolean };
export class Klass { x = 1; go(): void {} }
export type AliasToClass = Klass;
`;

describe('type alias serialization — reference aliases carry no members of their own', () => {
  const memberNames = (e: SpecExport | undefined) => e?.members?.map((m) => m.name);

  test('generic alias to a generic interface: $ref + type arguments, no members', async () => {
    const result = await extract({ entryFile: 'test.ts', content: REFERENCE_ALIASES });
    const exp = result.spec.exports.find((e) => e.name === 'InferAgentUIMessage');
    const schema = exp?.schema as Record<string, unknown>;
    expect(schema.$ref).toBe('#/types/UIMessage');
    expect(Array.isArray(schema['x-ts-type-arguments'])).toBe(true);
    expect((schema['x-ts-type-arguments'] as unknown[]).length).toBe(3);
    expect(exp?.members).toBeUndefined();

    const type = result.spec.types?.find((t) => t.name === 'InferAgentUIMessage');
    expect((type?.schema as Record<string, unknown>)?.$ref).toBe('#/types/UIMessage');
    expect((type as { members?: unknown })?.members).toBeUndefined();
  });

  test('concrete instantiation alias: $ref to the target + type arguments, no members', async () => {
    const result = await extract({ entryFile: 'test.ts', content: REFERENCE_ALIASES });
    const exp = result.spec.exports.find((e) => e.name === 'ConcreteMessage');
    const schema = exp?.schema as Record<string, unknown>;
    expect(schema.$ref).toBe('#/types/UIMessage');
    expect(schema['x-ts-type-arguments']).toEqual([
      { type: 'string' },
      { type: 'number' },
      { type: 'boolean' },
    ]);
    expect(schema['x-ts-type']).toBe('UIMessage<string, number, boolean>');
    expect(exp?.members).toBeUndefined();

    const type = result.spec.types?.find((t) => t.name === 'ConcreteMessage');
    expect((type?.schema as Record<string, unknown>)?.$ref).toBe('#/types/UIMessage');
    expect((type?.schema as Record<string, unknown>)?.properties).toBeUndefined();
  });

  test('the referenced interface still carries its own members', async () => {
    const result = await extract({ entryFile: 'test.ts', content: REFERENCE_ALIASES });
    const ui = result.spec.exports.find((e) => e.name === 'UIMessage');
    expect(memberNames(ui)).toEqual(['id', 'role', 'metadata', 'parts']);
    expect(ui?.members?.find((m) => m.name === 'id')?.description).toBe('Message id');
  });

  test('alias to a named interface / class / object-literal alias: $ref, no members', async () => {
    const result = await extract({ entryFile: 'test.ts', content: REFERENCE_ALIASES });
    for (const [name, target] of [
      ['AliasToNamed', 'Named'],
      ['AliasToClass', 'Klass'],
      ['AliasToLit', 'Lit'],
    ]) {
      const exp = result.spec.exports.find((e) => e.name === name);
      expect((exp?.schema as Record<string, unknown>)?.$ref).toBe(`#/types/${target}`);
      expect(exp?.members).toBeUndefined();
    }
  });

  test('conditional alias resolving to a named type: $ref, no members', async () => {
    const result = await extract({ entryFile: 'test.ts', content: REFERENCE_ALIASES });
    const exp = result.spec.exports.find((e) => e.name === 'CondToNamed');
    expect((exp?.schema as Record<string, unknown>)?.$ref).toBe('#/types/Named');
    expect(exp?.members).toBeUndefined();
  });

  test('object-literal, intersection, Pick and mapped aliases keep their own members', async () => {
    const result = await extract({ entryFile: 'test.ts', content: REFERENCE_ALIASES });
    const byName = (name: string) => result.spec.exports.find((e) => e.name === name);
    expect(memberNames(byName('Lit'))).toEqual(['a']);
    expect(memberNames(byName('WithExtra'))?.sort()).toEqual(['age', 'extra', 'name']);
    // Pick<Named, 'name'> and a mapped body own their resolved shape — no
    // registered type carries exactly these members. Text stays as written.
    const picked = byName('Picked');
    expect(memberNames(picked)).toEqual(['name']);
    expect((picked?.schema as Record<string, unknown>)['x-ts-declared']).toBe(
      "Pick<Named, 'name'>",
    );
    expect(memberNames(byName('Mapped'))?.sort()).toEqual(['age', 'name']);
  });

  test('class and interface exports are unchanged', async () => {
    const result = await extract({ entryFile: 'test.ts', content: REFERENCE_ALIASES });
    const klass = result.spec.exports.find((e) => e.name === 'Klass');
    expect(klass?.kind).toBe('class');
    expect(memberNames(klass)).toEqual(['x', 'go']);
    const named = result.spec.exports.find((e) => e.name === 'Named');
    expect(memberNames(named)).toEqual(['name', 'age']);
  });
});
