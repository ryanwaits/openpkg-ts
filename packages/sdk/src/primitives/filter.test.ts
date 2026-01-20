import { describe, expect, test } from 'bun:test';
import type { OpenPkg, SpecExport } from '@openpkg-ts/spec';
import { filterSpec } from './filter';

function makeSpec(exports: SpecExport[]): OpenPkg {
  return {
    openpkg: '0.4.0',
    meta: { name: 'test' },
    exports,
  };
}

function makeExport(overrides: Partial<SpecExport> & { id: string; name: string }): SpecExport {
  return {
    kind: 'function',
    ...overrides,
  };
}

describe('filterSpec', () => {
  test('empty criteria returns all exports', () => {
    const spec = makeSpec([
      makeExport({ id: 'a', name: 'foo' }),
      makeExport({ id: 'b', name: 'bar' }),
    ]);
    const result = filterSpec(spec, {});
    expect(result.matched).toBe(2);
    expect(result.total).toBe(2);
    expect(result.spec.exports.length).toBe(2);
  });

  test('empty spec returns empty result', () => {
    const spec = makeSpec([]);
    const result = filterSpec(spec, { kinds: ['function'] });
    expect(result.matched).toBe(0);
    expect(result.total).toBe(0);
  });

  test('filter by single kind', () => {
    const spec = makeSpec([
      makeExport({ id: 'a', name: 'foo', kind: 'function' }),
      makeExport({ id: 'b', name: 'Bar', kind: 'class' }),
      makeExport({ id: 'c', name: 'Baz', kind: 'interface' }),
    ]);
    const result = filterSpec(spec, { kinds: ['function'] });
    expect(result.matched).toBe(1);
    expect(result.spec.exports[0].name).toBe('foo');
  });

  test('filter by multiple kinds', () => {
    const spec = makeSpec([
      makeExport({ id: 'a', name: 'foo', kind: 'function' }),
      makeExport({ id: 'b', name: 'Bar', kind: 'class' }),
      makeExport({ id: 'c', name: 'Baz', kind: 'interface' }),
    ]);
    const result = filterSpec(spec, { kinds: ['function', 'class'] });
    expect(result.matched).toBe(2);
  });

  test('filter by names', () => {
    const spec = makeSpec([
      makeExport({ id: 'a', name: 'foo' }),
      makeExport({ id: 'b', name: 'bar' }),
      makeExport({ id: 'c', name: 'baz' }),
    ]);
    const result = filterSpec(spec, { names: ['foo', 'baz'] });
    expect(result.matched).toBe(2);
    expect(result.spec.exports.map((e) => e.name)).toEqual(['foo', 'baz']);
  });

  test('filter by ids', () => {
    const spec = makeSpec([
      makeExport({ id: 'export-1', name: 'foo' }),
      makeExport({ id: 'export-2', name: 'bar' }),
    ]);
    const result = filterSpec(spec, { ids: ['export-1'] });
    expect(result.matched).toBe(1);
    expect(result.spec.exports[0].name).toBe('foo');
  });

  test('filter by deprecated true', () => {
    const spec = makeSpec([
      makeExport({ id: 'a', name: 'foo', deprecated: true }),
      makeExport({ id: 'b', name: 'bar', deprecated: false }),
      makeExport({ id: 'c', name: 'baz' }),
    ]);
    const result = filterSpec(spec, { deprecated: true });
    expect(result.matched).toBe(1);
    expect(result.spec.exports[0].name).toBe('foo');
  });

  test('filter by deprecated false', () => {
    const spec = makeSpec([
      makeExport({ id: 'a', name: 'foo', deprecated: true }),
      makeExport({ id: 'b', name: 'bar', deprecated: false }),
      makeExport({ id: 'c', name: 'baz' }),
    ]);
    const result = filterSpec(spec, { deprecated: false });
    expect(result.matched).toBe(2);
  });

  test('filter by hasDescription true', () => {
    const spec = makeSpec([
      makeExport({ id: 'a', name: 'foo', description: 'Does something' }),
      makeExport({ id: 'b', name: 'bar', description: '' }),
      makeExport({ id: 'c', name: 'baz' }),
    ]);
    const result = filterSpec(spec, { hasDescription: true });
    expect(result.matched).toBe(1);
    expect(result.spec.exports[0].name).toBe('foo');
  });

  test('filter by hasDescription false', () => {
    const spec = makeSpec([
      makeExport({ id: 'a', name: 'foo', description: 'Does something' }),
      makeExport({ id: 'b', name: 'bar', description: '' }),
      makeExport({ id: 'c', name: 'baz' }),
    ]);
    const result = filterSpec(spec, { hasDescription: false });
    expect(result.matched).toBe(2);
  });

  test('filter by search in name', () => {
    const spec = makeSpec([
      makeExport({ id: 'a', name: 'createUser' }),
      makeExport({ id: 'b', name: 'deleteUser' }),
      makeExport({ id: 'c', name: 'getItem' }),
    ]);
    const result = filterSpec(spec, { search: 'user' });
    expect(result.matched).toBe(2);
  });

  test('filter by search in description', () => {
    const spec = makeSpec([
      makeExport({ id: 'a', name: 'foo', description: 'Handles user creation' }),
      makeExport({ id: 'b', name: 'bar', description: 'Deletes items' }),
    ]);
    const result = filterSpec(spec, { search: 'user' });
    expect(result.matched).toBe(1);
    expect(result.spec.exports[0].name).toBe('foo');
  });

  test('filter by module path', () => {
    const spec = makeSpec([
      makeExport({ id: 'a', name: 'foo', source: { file: 'src/utils/string.ts' } }),
      makeExport({ id: 'b', name: 'bar', source: { file: 'src/core/main.ts' } }),
    ]);
    const result = filterSpec(spec, { module: 'utils' });
    expect(result.matched).toBe(1);
    expect(result.spec.exports[0].name).toBe('foo');
  });

  test('filter by tags', () => {
    const spec = makeSpec([
      makeExport({ id: 'a', name: 'foo', tags: [{ name: 'beta', text: '' }] }),
      makeExport({ id: 'b', name: 'bar', tags: [{ name: 'internal', text: '' }] }),
      makeExport({ id: 'c', name: 'baz' }),
    ]);
    const result = filterSpec(spec, { tags: ['beta'] });
    expect(result.matched).toBe(1);
    expect(result.spec.exports[0].name).toBe('foo');
  });

  test('multiple criteria use AND logic', () => {
    const spec = makeSpec([
      makeExport({ id: 'a', name: 'createUser', kind: 'function', deprecated: false }),
      makeExport({ id: 'b', name: 'deleteUser', kind: 'function', deprecated: true }),
      makeExport({ id: 'c', name: 'User', kind: 'class', deprecated: false }),
    ]);
    const result = filterSpec(spec, { kinds: ['function'], deprecated: false });
    expect(result.matched).toBe(1);
    expect(result.spec.exports[0].name).toBe('createUser');
  });

  test('immutability - original spec unchanged', () => {
    const original = makeSpec([
      makeExport({ id: 'a', name: 'foo' }),
      makeExport({ id: 'b', name: 'bar' }),
    ]);
    const originalLength = original.exports.length;

    const result = filterSpec(original, { names: ['foo'] });

    expect(original.exports.length).toBe(originalLength);
    expect(result.spec.exports.length).toBe(1);
    expect(result.spec).not.toBe(original);
    expect(result.spec.exports).not.toBe(original.exports);
  });

  test('types are preserved (not pruned)', () => {
    const spec: OpenPkg = {
      openpkg: '0.4.0',
      meta: { name: 'test' },
      exports: [
        makeExport({ id: 'a', name: 'foo', kind: 'function' }),
        makeExport({ id: 'b', name: 'Bar', kind: 'class' }),
      ],
      types: [
        { id: 'type-1', name: 'Config', kind: 'interface' },
        { id: 'type-2', name: 'Options', kind: 'type' },
      ],
    };

    const result = filterSpec(spec, { kinds: ['function'] });
    expect(result.spec.exports.length).toBe(1);
    expect(result.spec.types?.length).toBe(2);
  });

  test('types array immutability', () => {
    const spec: OpenPkg = {
      openpkg: '0.4.0',
      meta: { name: 'test' },
      exports: [makeExport({ id: 'a', name: 'foo' })],
      types: [{ id: 'type-1', name: 'Config', kind: 'interface' }],
    };

    const result = filterSpec(spec, {});
    expect(result.spec.types).not.toBe(spec.types);
  });
});
