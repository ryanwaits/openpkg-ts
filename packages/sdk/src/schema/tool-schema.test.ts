import { describe, expect, test } from 'bun:test';
import type { OpenPkg, SpecExport } from '@openpkg-ts/spec';
import { toToolSchema } from './tool-schema';

const fnExport = (overrides: Partial<SpecExport> = {}): SpecExport =>
  ({
    id: 'search',
    name: 'search',
    kind: 'function',
    description: 'Search things',
    signatures: [
      {
        parameters: [
          { name: 'query', schema: { type: 'string' }, required: true, description: 'the query' },
          { name: 'limit', schema: { type: 'number' }, required: false },
        ],
        returns: { schema: { type: 'string' } },
      },
    ],
    ...overrides,
  }) as SpecExport;

const spec = (exp: SpecExport, types: OpenPkg['types'] = []): OpenPkg =>
  ({ openpkg: '0.4.0', meta: { name: 't' }, exports: [exp], types }) as OpenPkg;

describe('toToolSchema — openai-strict', () => {
  test('wraps params into a strict object schema', () => {
    const exp = fnExport();
    const result = toToolSchema(exp, spec(exp), { provider: 'openai-strict' });
    expect(result.name).toBe('search');
    expect(result.description).toBe('Search things');
    expect(result.parameters.type).toBe('object');
    expect(result.parameters.additionalProperties).toBe(false);
    const props = result.parameters.properties as Record<string, unknown>;
    expect(Object.keys(props)).toEqual(['query', 'limit']);
    // strict mode requires all properties in `required`
    expect(result.parameters.required).toEqual(['query', 'limit']);
  });

  test('nested objects also get additionalProperties:false', () => {
    const exp = fnExport({
      signatures: [
        {
          parameters: [
            {
              name: 'opts',
              required: true,
              schema: { type: 'object', properties: { a: { type: 'string' } }, required: ['a'] },
            },
          ],
        },
      ],
    });
    const result = toToolSchema(exp, spec(exp), { provider: 'openai-strict' });
    const opts = (result.parameters.properties as Record<string, Record<string, unknown>>).opts;
    expect(opts.additionalProperties).toBe(false);
  });

  test('drops disallowed keywords with warnings', () => {
    const exp = fnExport({
      signatures: [
        {
          parameters: [
            {
              name: 'v',
              required: true,
              schema: { type: 'string', minLength: 2, default: 'x' } as never,
            },
          ],
        },
      ],
    });
    const result = toToolSchema(exp, spec(exp), { provider: 'openai-strict' });
    const v = (result.parameters.properties as Record<string, Record<string, unknown>>).v;
    expect(v.minLength).toBeUndefined();
    expect(v.default).toBeUndefined();
    expect(result.warnings.some((w) => w.includes('minLength'))).toBe(true);
  });

  test('lowers oneOf to anyOf', () => {
    const exp = fnExport({
      signatures: [
        {
          parameters: [
            {
              name: 'mode',
              required: true,
              schema: { oneOf: [{ const: 'a' }, { const: 'b' }] } as never,
            },
          ],
        },
      ],
    });
    const result = toToolSchema(exp, spec(exp), { provider: 'openai-strict' });
    const mode = (result.parameters.properties as Record<string, Record<string, unknown>>).mode;
    expect(mode.anyOf).toBeDefined();
    expect(mode.oneOf).toBeUndefined();
  });

  test('prunes function-typed properties from properties and required', () => {
    const exp = fnExport({
      signatures: [
        {
          parameters: [
            {
              name: 'cfg',
              required: true,
              schema: {
                type: 'object',
                properties: { cb: { 'x-ts-function': true }, name: { type: 'string' } },
                required: ['cb', 'name'],
              } as never,
            },
          ],
        },
      ],
    });
    const result = toToolSchema(exp, spec(exp), { provider: 'openai-strict' });
    const cfg = (result.parameters.properties as Record<string, Record<string, unknown>>).cfg;
    const props = cfg.properties as Record<string, unknown>;
    expect(props.cb).toBeUndefined();
    expect(props.name).toBeDefined();
    expect(cfg.required).toEqual(['name']);
    expect(result.warnings.some((w) => w.includes('cb'))).toBe(true);
  });

  test('strips x-ts-* keywords', () => {
    const exp = fnExport({
      signatures: [
        { parameters: [{ name: 'q', required: true, schema: { type: 'string', 'x-ts-type': 'Query' } as never }] },
      ],
    });
    const result = toToolSchema(exp, spec(exp), { provider: 'openai-strict' });
    const q = (result.parameters.properties as Record<string, Record<string, unknown>>).q;
    expect(q['x-ts-type']).toBeUndefined();
  });
});

describe('toToolSchema — anthropic', () => {
  test('lenient: no additionalProperties injection, natural required', () => {
    const exp = fnExport();
    const result = toToolSchema(exp, spec(exp), { provider: 'anthropic' });
    expect(result.parameters.additionalProperties).toBeUndefined();
    expect(result.parameters.required).toEqual(['query']);
  });

  test('inlines refs and strips x-ts-*', () => {
    const exp = fnExport({
      signatures: [
        { parameters: [{ name: 'u', required: true, schema: { $ref: '#/types/User' } }] },
      ],
    });
    const s = spec(exp, [
      { id: 'User', name: 'User', kind: 'interface', schema: { type: 'object', 'x-ts-type': 'User' } as never },
    ]);
    const result = toToolSchema(exp, s, { provider: 'anthropic' });
    const u = (result.parameters.properties as Record<string, Record<string, unknown>>).u;
    // ref bundled into $defs
    expect(u.$ref).toBe('#/$defs/User');
    expect((result.parameters.$defs as Record<string, Record<string, unknown>>).User['x-ts-type']).toBeUndefined();
  });

  test('prunes function-typed props', () => {
    const exp = fnExport({
      signatures: [
        {
          parameters: [
            {
              name: 'cfg',
              required: true,
              schema: {
                type: 'object',
                properties: { cb: { 'x-ts-function': true }, name: { type: 'string' } },
                required: ['cb', 'name'],
              } as never,
            },
          ],
        },
      ],
    });
    const result = toToolSchema(exp, spec(exp), { provider: 'anthropic' });
    const cfg = (result.parameters.properties as Record<string, Record<string, unknown>>).cfg;
    expect((cfg.properties as Record<string, unknown>).cb).toBeUndefined();
    expect(cfg.required).toEqual(['name']);
  });
});

describe('toToolSchema — errors', () => {
  test('non-function export throws TypeError', () => {
    const exp = { id: 'x', name: 'x', kind: 'variable', schema: { type: 'string' } } as SpecExport;
    expect(() => toToolSchema(exp, spec(exp), { provider: 'anthropic' })).toThrow(TypeError);
  });
});
