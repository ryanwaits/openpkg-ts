import { describe, expect, test } from 'bun:test';
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
    expect(point?.members).toBeUndefined();
  });
});
