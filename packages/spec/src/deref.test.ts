import { describe, expect, test } from 'bun:test';
import { dereference } from './deref';
import type { OpenPkg } from './types';

const baseSpec = (overrides: Partial<OpenPkg>): OpenPkg =>
  ({
    openpkg: '0.4.0',
    meta: { name: 'fixture', version: '0.0.0', ecosystem: 'js/ts' },
    exports: [],
    ...overrides,
  }) as OpenPkg;

describe('dereference', () => {
  test('inlines resolvable refs', () => {
    const spec = baseSpec({
      exports: [
        {
          id: 'fn',
          name: 'fn',
          kind: 'function',
          schema: { $ref: '#/types/User' },
        },
      ] as OpenPkg['exports'],
      types: [{ id: 'User', name: 'User', kind: 'interface', schema: { type: 'object' } }],
    });
    const result = dereference(spec);
    expect(result.exports[0]?.schema).toEqual({ type: 'object' });
  });

  test('preserves ref siblings when resolving', () => {
    const spec = baseSpec({
      exports: [
        {
          id: 'fn',
          name: 'fn',
          kind: 'function',
          schema: {
            $ref: '#/types/Box',
            'x-ts-type-arguments': [{ type: 'string' }],
            'x-ts-package': 'some-lib',
            description: 'a box',
          },
        },
      ] as OpenPkg['exports'],
      types: [{ id: 'Box', name: 'Box', kind: 'interface', schema: { type: 'object' } }],
    });
    const result = dereference(spec);
    expect(result.exports[0]?.schema).toEqual({
      type: 'object',
      'x-ts-type-arguments': [{ type: 'string' }],
      'x-ts-package': 'some-lib',
      description: 'a box',
    });
  });

  test('preserves siblings on unresolvable refs', () => {
    const spec = baseSpec({
      exports: [
        {
          id: 'fn',
          name: 'fn',
          kind: 'function',
          schema: {
            $ref: '#/types/Missing',
            'x-ts-type-arguments': [{ type: 'number' }],
          },
        },
      ] as OpenPkg['exports'],
      types: [],
    });
    const result = dereference(spec);
    expect(result.exports[0]?.schema).toEqual({
      $ref: '#/types/Missing',
      'x-ts-type-arguments': [{ type: 'number' }],
    });
  });

  test('target schema keys win over stale siblings', () => {
    const spec = baseSpec({
      exports: [
        {
          id: 'fn',
          name: 'fn',
          kind: 'function',
          schema: { $ref: '#/types/User', description: 'stale' },
        },
      ] as OpenPkg['exports'],
      types: [
        {
          id: 'User',
          name: 'User',
          kind: 'interface',
          schema: { type: 'object', description: 'fresh' },
        },
      ],
    });
    const result = dereference(spec);
    expect((result.exports[0]?.schema as Record<string, unknown>).description).toBe('fresh');
  });

  test('circular refs terminate with a self ref', () => {
    const spec = baseSpec({
      exports: [],
      types: [
        {
          id: 'Node',
          name: 'Node',
          kind: 'interface',
          schema: {
            type: 'object',
            properties: { next: { $ref: '#/types/Node' } },
          },
        },
      ],
    });
    const result = dereference(spec);
    const node = result.types?.[0]?.schema as Record<string, unknown>;
    const props = node.properties as Record<string, unknown>;
    // One-level inline; the nested self-reference stays a ref (cycle guard)
    expect(props.next).toEqual({
      type: 'object',
      properties: { next: { $ref: '#/types/Node' } },
    });
  });
});
