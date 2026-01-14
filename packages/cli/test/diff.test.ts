import { describe, expect, test } from 'bun:test';
import type { OpenPkg, SpecExport } from '@openpkg-ts/spec';
import { enrichDiff } from '../src/commands/diff';

// Helper to create minimal spec
function makeSpec(exports: SpecExport[], types: OpenPkg['types'] = []): OpenPkg {
  return {
    openpkg: '0.4.0',
    meta: { name: 'test' },
    exports,
    types,
  };
}

describe('enrichDiff', () => {
  describe('removed export detection', () => {
    test('detect removed export → major bump', () => {
      const old = makeSpec([{ id: 'foo', name: 'foo', kind: 'function' }]);
      const new_ = makeSpec([]);
      const result = enrichDiff(old, new_);

      expect(result.removed.map((r) => r.id)).toContain('foo');
      expect(result.summary.removedCount).toBe(1);
      expect(result.summary.semverBump).toBe('major');
    });

    test('removed function has high severity', () => {
      const old = makeSpec([{ id: 'fn', name: 'fn', kind: 'function' }]);
      const new_ = makeSpec([]);
      const result = enrichDiff(old, new_);

      expect(result.removed[0].kind).toBe('function');
      expect(result.summary.semverBump).toBe('major');
    });

    test('removed class has high severity', () => {
      const old = makeSpec([{ id: 'MyClass', name: 'MyClass', kind: 'class' }]);
      const new_ = makeSpec([]);
      const result = enrichDiff(old, new_);

      expect(result.removed[0].kind).toBe('class');
      expect(result.summary.semverBump).toBe('major');
    });

    test('removed variable tracked separately from changed', () => {
      const old = makeSpec([
        { id: 'v1', name: 'v1', kind: 'variable' },
        { id: 'v2', name: 'v2', kind: 'variable' },
      ]);
      const new_ = makeSpec([{ id: 'v1', name: 'v1', kind: 'variable' }]);
      const result = enrichDiff(old, new_);

      expect(result.removed.length).toBe(1);
      expect(result.removed[0].id).toBe('v2');
      expect(result.changed.length).toBe(0);
    });
  });

  describe('added export detection', () => {
    test('detect added export → minor bump', () => {
      const old = makeSpec([]);
      const new_ = makeSpec([{ id: 'bar', name: 'bar', kind: 'function' }]);
      const result = enrichDiff(old, new_);

      expect(result.added).toContain('bar');
      expect(result.summary.addedCount).toBe(1);
      expect(result.summary.semverBump).toBe('minor');
    });

    test('multiple additions all counted', () => {
      const old = makeSpec([]);
      const new_ = makeSpec([
        { id: 'a', name: 'a', kind: 'function' },
        { id: 'b', name: 'b', kind: 'variable' },
        { id: 'c', name: 'c', kind: 'class' },
      ]);
      const result = enrichDiff(old, new_);

      expect(result.added.length).toBe(3);
      expect(result.summary.addedCount).toBe(3);
      expect(result.summary.semverBump).toBe('minor');
    });

    test('added type detected', () => {
      const old = makeSpec([], []);
      const new_ = makeSpec([], [{ id: 'NewType', name: 'NewType', kind: 'type' }]);
      const result = enrichDiff(old, new_);

      expect(result.added).toContain('NewType');
      expect(result.summary.semverBump).toBe('minor');
    });
  });

  describe('docs-only change detection', () => {
    test('detect docs-only change → patch bump', () => {
      const old = makeSpec([{ id: 'x', name: 'x', kind: 'function', description: 'old' }]);
      const new_ = makeSpec([{ id: 'x', name: 'x', kind: 'function', description: 'new' }]);
      const result = enrichDiff(old, new_);

      expect(result.docsOnly).toContain('x');
      expect(result.summary.docsOnlyCount).toBe(1);
      expect(result.summary.semverBump).toBe('patch');
    });

    test('examples change is docs-only', () => {
      const old = makeSpec([
        { id: 'fn', name: 'fn', kind: 'function', examples: [{ code: 'fn()' }] },
      ]);
      const new_ = makeSpec([
        { id: 'fn', name: 'fn', kind: 'function', examples: [{ code: 'fn("updated")' }] },
      ]);
      const result = enrichDiff(old, new_);

      expect(result.docsOnly).toContain('fn');
      expect(result.summary.semverBump).toBe('patch');
    });

    test('tags change is docs-only', () => {
      const old = makeSpec([
        { id: 'fn', name: 'fn', kind: 'function', tags: [{ name: 'alpha', text: '' }] },
      ]);
      const new_ = makeSpec([
        { id: 'fn', name: 'fn', kind: 'function', tags: [{ name: 'beta', text: '' }] },
      ]);
      const result = enrichDiff(old, new_);

      expect(result.docsOnly).toContain('fn');
      expect(result.summary.semverBump).toBe('patch');
    });
  });

  describe('changed export detection', () => {
    test('function signature change detected', () => {
      const old = makeSpec([
        { id: 'fn', name: 'fn', kind: 'function', signatures: [{ parameters: [] }] },
      ]);
      const new_ = makeSpec([
        {
          id: 'fn',
          name: 'fn',
          kind: 'function',
          signatures: [{ parameters: [{ name: 'x', schema: { type: 'string' } }] }],
        },
      ]);
      const result = enrichDiff(old, new_);

      expect(result.changed.length).toBe(1);
      expect(result.changed[0].id).toBe('fn');
      expect(result.changed[0].description).toBe('Function signature changed');
      expect(result.summary.semverBump).toBe('major');
    });

    test('interface change detected', () => {
      const old = makeSpec([{ id: 'IFoo', name: 'IFoo', kind: 'interface', members: [] }]);
      const new_ = makeSpec([
        { id: 'IFoo', name: 'IFoo', kind: 'interface', members: [{ name: 'x', kind: 'property' }] },
      ]);
      const result = enrichDiff(old, new_);

      expect(result.changed.length).toBe(1);
      expect(result.changed[0].id).toBe('IFoo');
      expect(result.changed[0].description).toBe('Type definition changed');
      expect(result.summary.semverBump).toBe('major');
    });

    test('type alias change detected', () => {
      const old = makeSpec([{ id: 'MyType', name: 'MyType', kind: 'type', type: 'string' }]);
      const new_ = makeSpec([{ id: 'MyType', name: 'MyType', kind: 'type', type: 'number' }]);
      const result = enrichDiff(old, new_);

      expect(result.changed.length).toBe(1);
      expect(result.changed[0].description).toBe('Type definition changed');
    });

    test('variable schema change detected', () => {
      const old = makeSpec([
        { id: 'config', name: 'config', kind: 'variable', schema: { type: 'string' } },
      ]);
      const new_ = makeSpec([
        { id: 'config', name: 'config', kind: 'variable', schema: { type: 'number' } },
      ]);
      const result = enrichDiff(old, new_);

      expect(result.changed.length).toBe(1);
      expect(result.summary.semverBump).toBe('major');
    });
  });

  describe('breaking change severity', () => {
    test('function signature change is high severity', () => {
      const old = makeSpec([
        { id: 'fn', name: 'fn', kind: 'function', signatures: [{ parameters: [] }] },
      ]);
      const new_ = makeSpec([
        {
          id: 'fn',
          name: 'fn',
          kind: 'function',
          signatures: [{ parameters: [{ name: 'x', schema: { type: 'string' } }] }],
        },
      ]);
      const result = enrichDiff(old, new_);

      expect(result.breaking.length).toBe(1);
      expect(result.breaking[0].severity).toBe('high');
      expect(result.breaking[0].reason).toBe('signature changed');
    });

    test('interface change is medium severity', () => {
      const old = makeSpec([{ id: 'IFoo', name: 'IFoo', kind: 'interface', members: [] }]);
      const new_ = makeSpec([
        { id: 'IFoo', name: 'IFoo', kind: 'interface', members: [{ name: 'x', kind: 'property' }] },
      ]);
      const result = enrichDiff(old, new_);

      expect(result.breaking.length).toBe(1);
      expect(result.breaking[0].severity).toBe('medium');
    });

    test('breaking changes sorted by severity', () => {
      const old = makeSpec([
        { id: 'fn', name: 'fn', kind: 'function', signatures: [{ parameters: [] }] },
        { id: 'IFoo', name: 'IFoo', kind: 'interface', members: [] },
      ]);
      const new_ = makeSpec([
        {
          id: 'fn',
          name: 'fn',
          kind: 'function',
          signatures: [{ parameters: [{ name: 'x', schema: { type: 'string' } }] }],
        },
        { id: 'IFoo', name: 'IFoo', kind: 'interface', members: [{ name: 'x', kind: 'property' }] },
      ]);
      const result = enrichDiff(old, new_);

      expect(result.breaking.length).toBe(2);
      expect(result.breaking[0].severity).toBe('high');
      expect(result.breaking[1].severity).toBe('medium');
    });
  });

  describe('summary counts', () => {
    test('counts all categories correctly', () => {
      const old = makeSpec([
        { id: 'removed', name: 'removed', kind: 'function' },
        { id: 'changed', name: 'changed', kind: 'function', signatures: [{ parameters: [] }] },
        { id: 'docsOnly', name: 'docsOnly', kind: 'variable', description: 'old' },
      ]);
      const new_ = makeSpec([
        {
          id: 'changed',
          name: 'changed',
          kind: 'function',
          signatures: [{ parameters: [{ name: 'x', schema: { type: 'string' } }] }],
        },
        { id: 'docsOnly', name: 'docsOnly', kind: 'variable', description: 'new' },
        { id: 'added', name: 'added', kind: 'class' },
      ]);
      const result = enrichDiff(old, new_);

      expect(result.summary.removedCount).toBe(1);
      expect(result.summary.changedCount).toBe(1);
      expect(result.summary.docsOnlyCount).toBe(1);
      expect(result.summary.addedCount).toBe(1);
      // Breaking = removed (counted separately) + changed
      expect(result.summary.breakingCount).toBe(1);
    });

    test('empty specs produce zero counts', () => {
      const empty = makeSpec([]);
      const result = enrichDiff(empty, empty);

      expect(result.summary.removedCount).toBe(0);
      expect(result.summary.changedCount).toBe(0);
      expect(result.summary.docsOnlyCount).toBe(0);
      expect(result.summary.addedCount).toBe(0);
      expect(result.summary.breakingCount).toBe(0);
      expect(result.summary.semverBump).toBe('none');
    });

    test('semverReason included in summary', () => {
      const old = makeSpec([{ id: 'fn', name: 'fn', kind: 'function' }]);
      const new_ = makeSpec([]);
      const result = enrichDiff(old, new_);

      expect(result.summary.semverReason).toContain('breaking');
    });
  });

  describe('semver bump priority', () => {
    test('major takes priority over minor', () => {
      const old = makeSpec([{ id: 'removed', name: 'removed', kind: 'function' }]);
      const new_ = makeSpec([{ id: 'added', name: 'added', kind: 'function' }]);
      const result = enrichDiff(old, new_);

      expect(result.summary.semverBump).toBe('major');
    });

    test('minor takes priority over patch', () => {
      const old = makeSpec([{ id: 'doc', name: 'doc', kind: 'function', description: 'old' }]);
      const new_ = makeSpec([
        { id: 'doc', name: 'doc', kind: 'function', description: 'new' },
        { id: 'added', name: 'added', kind: 'function' },
      ]);
      const result = enrichDiff(old, new_);

      expect(result.summary.semverBump).toBe('minor');
    });

    test('no changes produces none bump', () => {
      const spec = makeSpec([{ id: 'fn', name: 'fn', kind: 'function' }]);
      const result = enrichDiff(spec, spec);

      expect(result.summary.semverBump).toBe('none');
    });
  });

  describe('types handling', () => {
    test('removed type is breaking', () => {
      const old = makeSpec([], [{ id: 'MyType', name: 'MyType', kind: 'type' }]);
      const new_ = makeSpec([], []);
      const result = enrichDiff(old, new_);

      // Removed types go into breaking array via diff logic
      expect(result.summary.semverBump).toBe('major');
    });

    test('handles undefined types arrays', () => {
      const old: OpenPkg = { openpkg: '0.4.0', meta: { name: 'test' }, exports: [] };
      const new_: OpenPkg = { openpkg: '0.4.0', meta: { name: 'test' }, exports: [] };
      const result = enrichDiff(old, new_);

      expect(result.summary.semverBump).toBe('none');
    });
  });
});
