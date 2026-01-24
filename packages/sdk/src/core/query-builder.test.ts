import { describe, expect, test } from 'bun:test';
import type { OpenPkg, SpecExport } from '@openpkg-ts/spec';
import { query, QueryBuilder } from './query-builder';

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

describe('QueryBuilder', () => {
  describe('filters', () => {
    test('byKind filters by single kind', () => {
      const spec = makeSpec([
        makeExport({ id: 'a', name: 'foo', kind: 'function' }),
        makeExport({ id: 'b', name: 'Bar', kind: 'class' }),
        makeExport({ id: 'c', name: 'Baz', kind: 'interface' }),
      ]);
      const result = query(spec).byKind('function').find();
      expect(result.length).toBe(1);
      expect(result[0].name).toBe('foo');
    });

    test('byKind filters by multiple kinds', () => {
      const spec = makeSpec([
        makeExport({ id: 'a', name: 'foo', kind: 'function' }),
        makeExport({ id: 'b', name: 'Bar', kind: 'class' }),
        makeExport({ id: 'c', name: 'Baz', kind: 'interface' }),
      ]);
      const result = query(spec).byKind('function', 'class').find();
      expect(result.length).toBe(2);
    });

    test('byName matches string exactly', () => {
      const spec = makeSpec([
        makeExport({ id: 'a', name: 'foo' }),
        makeExport({ id: 'b', name: 'foobar' }),
        makeExport({ id: 'c', name: 'bar' }),
      ]);
      const result = query(spec).byName('foo').find();
      expect(result.length).toBe(1);
      expect(result[0].name).toBe('foo');
    });

    test('byName matches regex pattern', () => {
      const spec = makeSpec([
        makeExport({ id: 'a', name: 'useAuth' }),
        makeExport({ id: 'b', name: 'useState' }),
        makeExport({ id: 'c', name: 'createUser' }),
      ]);
      const result = query(spec).byName(/^use/).find();
      expect(result.length).toBe(2);
      expect(result.map((e) => e.name)).toEqual(['useAuth', 'useState']);
    });

    test('byTag filters exports with matching tag', () => {
      const spec = makeSpec([
        makeExport({ id: 'a', name: 'foo', tags: [{ name: 'beta', text: '' }] }),
        makeExport({ id: 'b', name: 'bar', tags: [{ name: 'internal', text: '' }] }),
        makeExport({ id: 'c', name: 'baz' }),
      ]);
      const result = query(spec).byTag('beta').find();
      expect(result.length).toBe(1);
      expect(result[0].name).toBe('foo');
    });

    test('byTag filters with multiple tags (OR)', () => {
      const spec = makeSpec([
        makeExport({ id: 'a', name: 'foo', tags: [{ name: 'beta', text: '' }] }),
        makeExport({ id: 'b', name: 'bar', tags: [{ name: 'internal', text: '' }] }),
        makeExport({ id: 'c', name: 'baz' }),
      ]);
      const result = query(spec).byTag('beta', 'internal').find();
      expect(result.length).toBe(2);
    });

    test('deprecated(true) returns only deprecated', () => {
      const spec = makeSpec([
        makeExport({ id: 'a', name: 'foo', deprecated: true }),
        makeExport({ id: 'b', name: 'bar', deprecated: false }),
        makeExport({ id: 'c', name: 'baz' }),
      ]);
      const result = query(spec).deprecated(true).find();
      expect(result.length).toBe(1);
      expect(result[0].name).toBe('foo');
    });

    test('deprecated(false) excludes deprecated', () => {
      const spec = makeSpec([
        makeExport({ id: 'a', name: 'foo', deprecated: true }),
        makeExport({ id: 'b', name: 'bar', deprecated: false }),
        makeExport({ id: 'c', name: 'baz' }),
      ]);
      const result = query(spec).deprecated(false).find();
      expect(result.length).toBe(2);
    });

    test('withDescription filters exports with descriptions', () => {
      const spec = makeSpec([
        makeExport({ id: 'a', name: 'foo', description: 'Does something' }),
        makeExport({ id: 'b', name: 'bar', description: '' }),
        makeExport({ id: 'c', name: 'baz' }),
      ]);
      const result = query(spec).withDescription().find();
      expect(result.length).toBe(1);
      expect(result[0].name).toBe('foo');
    });

    test('search matches name', () => {
      const spec = makeSpec([
        makeExport({ id: 'a', name: 'createUser' }),
        makeExport({ id: 'b', name: 'deleteUser' }),
        makeExport({ id: 'c', name: 'getItem' }),
      ]);
      const result = query(spec).search('user').find();
      expect(result.length).toBe(2);
    });

    test('search matches description', () => {
      const spec = makeSpec([
        makeExport({ id: 'a', name: 'foo', description: 'Handles user creation' }),
        makeExport({ id: 'b', name: 'bar', description: 'Deletes items' }),
      ]);
      const result = query(spec).search('user').find();
      expect(result.length).toBe(1);
      expect(result[0].name).toBe('foo');
    });

    test('search is case-insensitive', () => {
      const spec = makeSpec([
        makeExport({ id: 'a', name: 'CreateUser' }),
        makeExport({ id: 'b', name: 'getItem' }),
      ]);
      const result = query(spec).search('USER').find();
      expect(result.length).toBe(1);
    });

    test('where accepts custom predicate', () => {
      const spec = makeSpec([
        makeExport({ id: 'a', name: 'a' }),
        makeExport({ id: 'b', name: 'bb' }),
        makeExport({ id: 'c', name: 'ccc' }),
      ]);
      const result = query(spec)
        .where((exp) => exp.name.length > 1)
        .find();
      expect(result.length).toBe(2);
    });

    test('byModule filters by source file path', () => {
      const spec = makeSpec([
        makeExport({ id: 'a', name: 'foo', source: { file: 'src/utils/string.ts' } }),
        makeExport({ id: 'b', name: 'bar', source: { file: 'src/core/main.ts' } }),
      ]);
      const result = query(spec).byModule('utils').find();
      expect(result.length).toBe(1);
      expect(result[0].name).toBe('foo');
    });
  });

  describe('chaining', () => {
    test('multiple filters combine with AND logic', () => {
      const spec = makeSpec([
        makeExport({ id: 'a', name: 'createUser', kind: 'function', deprecated: false }),
        makeExport({ id: 'b', name: 'deleteUser', kind: 'function', deprecated: true }),
        makeExport({ id: 'c', name: 'User', kind: 'class', deprecated: false }),
      ]);
      const result = query(spec).byKind('function').deprecated(false).find();
      expect(result.length).toBe(1);
      expect(result[0].name).toBe('createUser');
    });

    test('complex chaining works', () => {
      const spec = makeSpec([
        makeExport({
          id: 'a',
          name: 'useAuth',
          kind: 'function',
          description: 'Auth hook',
          tags: [{ name: 'hook', text: '' }],
        }),
        makeExport({
          id: 'b',
          name: 'useState',
          kind: 'function',
          description: 'State hook',
        }),
        makeExport({
          id: 'c',
          name: 'createUser',
          kind: 'function',
          tags: [{ name: 'hook', text: '' }],
        }),
      ]);
      const result = query(spec).byKind('function').byName(/^use/).withDescription().find();
      expect(result.length).toBe(2);
    });

    test('filters are lazy until execution', () => {
      const spec = makeSpec([
        makeExport({ id: 'a', name: 'foo' }),
        makeExport({ id: 'b', name: 'bar' }),
      ]);
      const qb = query(spec).byKind('function');
      // No execution yet - can add more filters
      qb.byName('foo');
      const result = qb.find();
      expect(result.length).toBe(1);
    });
  });

  describe('execution', () => {
    test('find() returns matching exports', () => {
      const spec = makeSpec([
        makeExport({ id: 'a', name: 'foo', kind: 'function' }),
        makeExport({ id: 'b', name: 'Bar', kind: 'class' }),
      ]);
      const result = query(spec).byKind('function').find();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(1);
    });

    test('first() returns first match', () => {
      const spec = makeSpec([
        makeExport({ id: 'a', name: 'foo' }),
        makeExport({ id: 'b', name: 'bar' }),
      ]);
      const result = query(spec).first();
      expect(result?.name).toBe('foo');
    });

    test('first() returns undefined when no match', () => {
      const spec = makeSpec([makeExport({ id: 'a', name: 'foo', kind: 'function' })]);
      const result = query(spec).byKind('class').first();
      expect(result).toBeUndefined();
    });

    test('count() returns number of matches', () => {
      const spec = makeSpec([
        makeExport({ id: 'a', name: 'foo', kind: 'function' }),
        makeExport({ id: 'b', name: 'bar', kind: 'function' }),
        makeExport({ id: 'c', name: 'Baz', kind: 'class' }),
      ]);
      const result = query(spec).byKind('function').count();
      expect(result).toBe(2);
    });

    test('ids() returns array of IDs', () => {
      const spec = makeSpec([
        makeExport({ id: 'export-1', name: 'foo' }),
        makeExport({ id: 'export-2', name: 'bar' }),
      ]);
      const result = query(spec).ids();
      expect(result).toEqual(['export-1', 'export-2']);
    });

    test('toSpec() returns filtered OpenPkg', () => {
      const spec = makeSpec([
        makeExport({ id: 'a', name: 'foo', kind: 'function' }),
        makeExport({ id: 'b', name: 'Bar', kind: 'class' }),
      ]);
      const result = query(spec).byKind('function').toSpec();
      expect(result.openpkg).toBe('0.4.0');
      expect(result.meta.name).toBe('test');
      expect(result.exports.length).toBe(1);
      expect(result.exports[0].name).toBe('foo');
    });

    test('toSpec() preserves types array', () => {
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
      const result = query(spec).byKind('function').toSpec();
      expect(result.exports.length).toBe(1);
      expect(result.types?.length).toBe(2);
    });

    test('toSpec() returns immutable copy', () => {
      const spec = makeSpec([
        makeExport({ id: 'a', name: 'foo' }),
        makeExport({ id: 'b', name: 'bar' }),
      ]);
      const result = query(spec).byName('foo').toSpec();
      expect(result).not.toBe(spec);
      expect(result.exports).not.toBe(spec.exports);
      expect(spec.exports.length).toBe(2);
    });
  });

  describe('factory function', () => {
    test('query() creates QueryBuilder instance', () => {
      const spec = makeSpec([]);
      const qb = query(spec);
      expect(qb).toBeInstanceOf(QueryBuilder);
    });
  });
});
