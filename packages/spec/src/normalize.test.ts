import { describe, expect, test } from 'bun:test';
import { normalize } from './normalize';
import type { OpenPkg } from './types';

describe('normalize', () => {
  test('adds default ecosystem when missing', () => {
    const spec: OpenPkg = {
      openpkg: '0.4.0',
      meta: { name: 'test' },
      exports: [],
    };
    const result = normalize(spec);
    expect(result.meta.ecosystem).toBe('js/ts');
  });

  test('preserves existing ecosystem', () => {
    const spec: OpenPkg = {
      openpkg: '0.4.0',
      meta: { name: 'test', ecosystem: 'python' },
      exports: [],
    };
    const result = normalize(spec);
    expect(result.meta.ecosystem).toBe('python');
  });

  test('sorts exports by name', () => {
    const spec: OpenPkg = {
      openpkg: '0.4.0',
      meta: { name: 'test' },
      exports: [
        { id: 'c', name: 'charlie', kind: 'function' },
        { id: 'a', name: 'alpha', kind: 'function' },
        { id: 'b', name: 'bravo', kind: 'function' },
      ],
    };
    const result = normalize(spec);
    expect(result.exports.map((e) => e.name)).toEqual(['alpha', 'bravo', 'charlie']);
  });

  test('sorts types by name', () => {
    const spec: OpenPkg = {
      openpkg: '0.4.0',
      meta: { name: 'test' },
      exports: [],
      types: [
        { id: 'Z', name: 'Zebra', kind: 'interface' },
        { id: 'A', name: 'Apple', kind: 'interface' },
      ],
    };
    const result = normalize(spec);
    expect(result.types?.map((t) => t.name)).toEqual(['Apple', 'Zebra']);
  });

  test('ensures array fields exist on exports', () => {
    const spec: OpenPkg = {
      openpkg: '0.4.0',
      meta: { name: 'test' },
      exports: [{ id: 'foo', name: 'foo', kind: 'function' }],
    };
    const result = normalize(spec);
    expect(result.exports[0].signatures).toEqual([]);
    expect(result.exports[0].members).toEqual([]);
    expect(result.exports[0].examples).toEqual([]);
    expect(result.exports[0].tags).toEqual([]);
  });

  test('ensures array fields exist on types', () => {
    const spec: OpenPkg = {
      openpkg: '0.4.0',
      meta: { name: 'test' },
      exports: [],
      types: [{ id: 'Foo', name: 'Foo', kind: 'interface' }],
    };
    const result = normalize(spec);
    expect(result.types?.[0].members).toEqual([]);
    expect(result.types?.[0].tags).toEqual([]);
  });

  test('moves object type to schema field on exports', () => {
    const spec = {
      openpkg: '0.4.0',
      meta: { name: 'test' },
      exports: [
        {
          id: 'foo',
          name: 'foo',
          kind: 'variable',
          type: { type: 'string' },
        },
      ],
    } as unknown as OpenPkg;
    const result = normalize(spec);
    expect(result.exports[0].type).toBeUndefined();
    expect(result.exports[0].schema).toEqual({ type: 'string' });
  });

  test('moves object type to schema field on types', () => {
    const spec = {
      openpkg: '0.4.0',
      meta: { name: 'test' },
      exports: [],
      types: [
        {
          id: 'Foo',
          name: 'Foo',
          kind: 'type',
          type: { type: 'number' },
        },
      ],
    } as unknown as OpenPkg;
    const result = normalize(spec);
    expect(result.types?.[0].type).toBeUndefined();
    expect(result.types?.[0].schema).toEqual({ type: 'number' });
  });

  test('does not overwrite existing schema when moving type', () => {
    const spec = {
      openpkg: '0.4.0',
      meta: { name: 'test' },
      exports: [
        {
          id: 'foo',
          name: 'foo',
          kind: 'variable',
          type: { type: 'string' },
          schema: { type: 'number' },
        },
      ],
    } as unknown as OpenPkg;
    const result = normalize(spec);
    expect(result.exports[0].schema).toEqual({ type: 'number' });
  });

  test('normalizes tags to only have name and text', () => {
    const spec = {
      openpkg: '0.4.0',
      meta: { name: 'test' },
      exports: [
        {
          id: 'foo',
          name: 'foo',
          kind: 'function',
          tags: [{ name: 'param', text: 'foo', extraField: 'should be removed' }],
        },
      ],
    } as unknown as OpenPkg;
    const result = normalize(spec);
    expect(result.exports[0].tags?.[0]).toEqual({ name: 'param', text: 'foo' });
    expect((result.exports[0].tags?.[0] as Record<string, unknown>).extraField).toBeUndefined();
  });

  test('preserves param field on tags', () => {
    const spec: OpenPkg = {
      openpkg: '0.4.0',
      meta: { name: 'test' },
      exports: [
        {
          id: 'foo',
          name: 'foo',
          kind: 'function',
          tags: [
            {
              name: 'param',
              text: 'x - description',
              param: { name: 'x', type: 'string', description: 'description' },
            },
          ],
        },
      ],
    };
    const result = normalize(spec);
    expect(result.exports[0].tags?.[0].param).toEqual({
      name: 'x',
      type: 'string',
      description: 'description',
    });
  });

  test('normalizes generation metadata with object generator', () => {
    const spec = {
      openpkg: '0.4.0',
      meta: { name: 'test' },
      exports: [],
      generation: {
        generator: { name: 'tspec', version: '1.0.0' },
        timestamp: '2024-01-01T00:00:00Z',
      },
    } as unknown as OpenPkg;
    const result = normalize(spec);
    expect(result.generation?.generator).toBe('tspec@1.0.0');
    expect(result.generation?.timestamp).toBe('2024-01-01T00:00:00Z');
  });

  test('preserves string generator in generation metadata', () => {
    const spec: OpenPkg = {
      openpkg: '0.4.0',
      meta: { name: 'test' },
      exports: [],
      generation: {
        generator: 'tspec@1.0.0',
        timestamp: '2024-01-01T00:00:00Z',
      },
    };
    const result = normalize(spec);
    expect(result.generation?.generator).toBe('tspec@1.0.0');
  });

  test('does not mutate original spec', () => {
    const spec: OpenPkg = {
      openpkg: '0.4.0',
      meta: { name: 'test' },
      exports: [
        { id: 'b', name: 'b', kind: 'function' },
        { id: 'a', name: 'a', kind: 'function' },
      ],
    };
    const original = JSON.stringify(spec);
    normalize(spec);
    expect(JSON.stringify(spec)).toBe(original);
  });

  test('handles empty exports array', () => {
    const spec: OpenPkg = {
      openpkg: '0.4.0',
      meta: { name: 'test' },
      exports: [],
    };
    const result = normalize(spec);
    expect(result.exports).toEqual([]);
  });

  test('handles missing types array', () => {
    const spec: OpenPkg = {
      openpkg: '0.4.0',
      meta: { name: 'test' },
      exports: [],
    };
    const result = normalize(spec);
    expect(result.types).toEqual([]);
  });

  test('normalizes member tags', () => {
    const spec = {
      openpkg: '0.4.0',
      meta: { name: 'test' },
      exports: [
        {
          id: 'Foo',
          name: 'Foo',
          kind: 'class',
          members: [
            {
              name: 'bar',
              kind: 'method',
              tags: [{ name: 'deprecated', text: '', extraProp: true }],
            },
          ],
        },
      ],
    } as unknown as OpenPkg;
    const result = normalize(spec);
    const memberTag = result.exports[0].members?.[0].tags?.[0];
    expect(memberTag).toEqual({ name: 'deprecated', text: '' });
    expect((memberTag as Record<string, unknown>).extraProp).toBeUndefined();
  });
});
