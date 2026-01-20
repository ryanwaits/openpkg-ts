import { describe, expect, test } from 'bun:test';
import {
  calculateNextVersion,
  categorizeBreakingChanges,
  diffSpec,
  type MemberChangeInfo,
  recommendSemverBump,
  type SpecDiff,
} from './diff';
import type { OpenPkg } from './types';

const baseSpec: OpenPkg = {
  openpkg: '0.4.0',
  meta: { name: 'test' },
  exports: [
    { id: 'foo', name: 'foo', kind: 'function', description: 'A function' },
    { id: 'bar', name: 'bar', kind: 'variable' },
  ],
  types: [{ id: 'MyType', name: 'MyType', kind: 'interface' }],
};

describe('diffSpec', () => {
  test('returns empty diff for identical specs', () => {
    const diff = diffSpec(baseSpec, baseSpec);
    expect(diff.breaking).toEqual([]);
    expect(diff.nonBreaking).toEqual([]);
    expect(diff.docsOnly).toEqual([]);
  });

  test('detects removed export as breaking', () => {
    const newSpec: OpenPkg = {
      ...baseSpec,
      exports: [{ id: 'foo', name: 'foo', kind: 'function', description: 'A function' }],
    };
    const diff = diffSpec(baseSpec, newSpec);
    expect(diff.breaking).toContain('bar');
  });

  test('detects added export as non-breaking', () => {
    const newSpec: OpenPkg = {
      ...baseSpec,
      exports: [...baseSpec.exports, { id: 'baz', name: 'baz', kind: 'function' }],
    };
    const diff = diffSpec(baseSpec, newSpec);
    expect(diff.nonBreaking).toContain('baz');
  });

  test('detects description change as docs-only', () => {
    const newSpec: OpenPkg = {
      ...baseSpec,
      exports: [
        { id: 'foo', name: 'foo', kind: 'function', description: 'Updated description' },
        { id: 'bar', name: 'bar', kind: 'variable' },
      ],
    };
    const diff = diffSpec(baseSpec, newSpec);
    expect(diff.docsOnly).toContain('foo');
    expect(diff.breaking).not.toContain('foo');
  });

  test('detects kind change as breaking', () => {
    const newSpec: OpenPkg = {
      ...baseSpec,
      exports: [
        { id: 'foo', name: 'foo', kind: 'variable', description: 'A function' },
        { id: 'bar', name: 'bar', kind: 'variable' },
      ],
    };
    const diff = diffSpec(baseSpec, newSpec);
    expect(diff.breaking).toContain('foo');
  });

  test('detects removed type as breaking', () => {
    const newSpec: OpenPkg = {
      ...baseSpec,
      types: [],
    };
    const diff = diffSpec(baseSpec, newSpec);
    expect(diff.breaking).toContain('MyType');
  });

  test('detects added type as non-breaking', () => {
    const newSpec: OpenPkg = {
      ...baseSpec,
      types: [
        { id: 'MyType', name: 'MyType', kind: 'interface' },
        { id: 'NewType', name: 'NewType', kind: 'type' },
      ],
    };
    const diff = diffSpec(baseSpec, newSpec);
    expect(diff.nonBreaking).toContain('NewType');
  });

  test('detects examples change as docs-only', () => {
    const oldSpec: OpenPkg = {
      ...baseSpec,
      exports: [{ id: 'foo', name: 'foo', kind: 'function', examples: [{ code: 'foo()' }] }],
    };
    const newSpec: OpenPkg = {
      ...baseSpec,
      exports: [
        { id: 'foo', name: 'foo', kind: 'function', examples: [{ code: 'foo("updated")' }] },
      ],
    };
    const diff = diffSpec(oldSpec, newSpec);
    expect(diff.docsOnly).toContain('foo');
  });

  test('detects tags change as docs-only', () => {
    const oldSpec: OpenPkg = {
      ...baseSpec,
      exports: [
        { id: 'foo', name: 'foo', kind: 'function', tags: [{ name: 'deprecated', text: '' }] },
      ],
    };
    const newSpec: OpenPkg = {
      ...baseSpec,
      exports: [{ id: 'foo', name: 'foo', kind: 'function', tags: [{ name: 'beta', text: '' }] }],
    };
    const diff = diffSpec(oldSpec, newSpec);
    expect(diff.docsOnly).toContain('foo');
  });

  test('handles empty specs', () => {
    const emptySpec: OpenPkg = {
      openpkg: '0.4.0',
      meta: { name: 'test' },
      exports: [],
    };
    const diff = diffSpec(emptySpec, emptySpec);
    expect(diff.breaking).toEqual([]);
    expect(diff.nonBreaking).toEqual([]);
    expect(diff.docsOnly).toEqual([]);
  });

  test('handles undefined types array', () => {
    const specNoTypes: OpenPkg = {
      openpkg: '0.4.0',
      meta: { name: 'test' },
      exports: [],
    };
    const specWithTypes: OpenPkg = {
      ...specNoTypes,
      types: [{ id: 'T', name: 'T', kind: 'type' }],
    };
    const diff = diffSpec(specNoTypes, specWithTypes);
    expect(diff.nonBreaking).toContain('T');
  });

  test('filters by kinds option', () => {
    const oldSpec: OpenPkg = {
      openpkg: '0.4.0',
      meta: { name: 'test' },
      exports: [
        { id: 'fn1', name: 'fn1', kind: 'function' },
        { id: 'var1', name: 'var1', kind: 'variable' },
      ],
    };
    const newSpec: OpenPkg = {
      openpkg: '0.4.0',
      meta: { name: 'test' },
      exports: [],
    };
    const diff = diffSpec(oldSpec, newSpec, { kinds: ['function'] });
    expect(diff.breaking).toContain('fn1');
    expect(diff.breaking).not.toContain('var1');
  });

  test('excludes docsOnly when includeDocsOnly is false', () => {
    const oldSpec: OpenPkg = {
      openpkg: '0.4.0',
      meta: { name: 'test' },
      exports: [{ id: 'foo', name: 'foo', kind: 'function', description: 'Original' }],
    };
    const newSpec: OpenPkg = {
      openpkg: '0.4.0',
      meta: { name: 'test' },
      exports: [{ id: 'foo', name: 'foo', kind: 'function', description: 'Updated' }],
    };
    const diff = diffSpec(oldSpec, newSpec, { includeDocsOnly: false });
    expect(diff.docsOnly).toEqual([]);
  });
});

describe('categorizeBreakingChanges', () => {
  test('categorizes removed function as high severity', () => {
    const oldSpec: OpenPkg = {
      openpkg: '0.4.0',
      meta: { name: 'test' },
      exports: [{ id: 'myFunc', name: 'myFunc', kind: 'function' }],
    };
    const newSpec: OpenPkg = {
      openpkg: '0.4.0',
      meta: { name: 'test' },
      exports: [],
    };
    const categorized = categorizeBreakingChanges(['myFunc'], oldSpec, newSpec);
    expect(categorized[0].severity).toBe('high');
    expect(categorized[0].reason).toBe('removed');
  });

  test('categorizes removed class as high severity', () => {
    const oldSpec: OpenPkg = {
      openpkg: '0.4.0',
      meta: { name: 'test' },
      exports: [{ id: 'MyClass', name: 'MyClass', kind: 'class' }],
    };
    const newSpec: OpenPkg = {
      openpkg: '0.4.0',
      meta: { name: 'test' },
      exports: [],
    };
    const categorized = categorizeBreakingChanges(['MyClass'], oldSpec, newSpec);
    expect(categorized[0].severity).toBe('high');
  });

  test('categorizes removed variable as medium severity', () => {
    const oldSpec: OpenPkg = {
      openpkg: '0.4.0',
      meta: { name: 'test' },
      exports: [{ id: 'myVar', name: 'myVar', kind: 'variable' }],
    };
    const newSpec: OpenPkg = {
      openpkg: '0.4.0',
      meta: { name: 'test' },
      exports: [],
    };
    const categorized = categorizeBreakingChanges(['myVar'], oldSpec, newSpec);
    expect(categorized[0].severity).toBe('medium');
  });

  test('categorizes interface change as medium severity', () => {
    const oldSpec: OpenPkg = {
      openpkg: '0.4.0',
      meta: { name: 'test' },
      exports: [{ id: 'IFoo', name: 'IFoo', kind: 'interface', members: [] }],
    };
    const newSpec: OpenPkg = {
      openpkg: '0.4.0',
      meta: { name: 'test' },
      exports: [
        { id: 'IFoo', name: 'IFoo', kind: 'interface', members: [{ name: 'x', kind: 'property' }] },
      ],
    };
    const categorized = categorizeBreakingChanges(['IFoo'], oldSpec, newSpec);
    expect(categorized[0].severity).toBe('medium');
    expect(categorized[0].reason).toBe('type definition changed');
  });

  test('categorizes function signature change as high severity', () => {
    const oldSpec: OpenPkg = {
      openpkg: '0.4.0',
      meta: { name: 'test' },
      exports: [{ id: 'fn', name: 'fn', kind: 'function', signatures: [{ parameters: [] }] }],
    };
    const newSpec: OpenPkg = {
      openpkg: '0.4.0',
      meta: { name: 'test' },
      exports: [
        {
          id: 'fn',
          name: 'fn',
          kind: 'function',
          signatures: [{ parameters: [{ name: 'x', schema: { type: 'string' } }] }],
        },
      ],
    };
    const categorized = categorizeBreakingChanges(['fn'], oldSpec, newSpec);
    expect(categorized[0].severity).toBe('high');
    expect(categorized[0].reason).toBe('signature changed');
  });

  test('handles class with member changes', () => {
    const oldSpec: OpenPkg = {
      openpkg: '0.4.0',
      meta: { name: 'test' },
      exports: [
        {
          id: 'MyClass',
          name: 'MyClass',
          kind: 'class',
          members: [{ name: 'foo', kind: 'method' }],
        },
      ],
    };
    const newSpec: OpenPkg = {
      openpkg: '0.4.0',
      meta: { name: 'test' },
      exports: [{ id: 'MyClass', name: 'MyClass', kind: 'class', members: [] }],
    };
    const memberChanges: MemberChangeInfo[] = [
      { className: 'MyClass', memberName: 'foo', memberKind: 'method', changeType: 'removed' },
    ];
    const categorized = categorizeBreakingChanges(['MyClass'], oldSpec, newSpec, memberChanges);
    expect(categorized[0].severity).toBe('high');
    expect(categorized[0].reason).toBe('methods removed');
  });

  test('handles class with constructor change', () => {
    const oldSpec: OpenPkg = {
      openpkg: '0.4.0',
      meta: { name: 'test' },
      exports: [{ id: 'MyClass', name: 'MyClass', kind: 'class' }],
    };
    const newSpec: OpenPkg = {
      openpkg: '0.4.0',
      meta: { name: 'test' },
      exports: [{ id: 'MyClass', name: 'MyClass', kind: 'class' }],
    };
    const memberChanges: MemberChangeInfo[] = [
      {
        className: 'MyClass',
        memberName: 'constructor',
        memberKind: 'constructor',
        changeType: 'signature-changed',
      },
    ];
    const categorized = categorizeBreakingChanges(['MyClass'], oldSpec, newSpec, memberChanges);
    expect(categorized[0].severity).toBe('high');
    expect(categorized[0].reason).toBe('constructor changed');
  });

  test('sorts by severity (high first)', () => {
    const oldSpec: OpenPkg = {
      openpkg: '0.4.0',
      meta: { name: 'test' },
      exports: [
        { id: 'var1', name: 'var1', kind: 'variable' },
        { id: 'func1', name: 'func1', kind: 'function' },
      ],
    };
    const newSpec: OpenPkg = {
      openpkg: '0.4.0',
      meta: { name: 'test' },
      exports: [],
    };
    const categorized = categorizeBreakingChanges(['var1', 'func1'], oldSpec, newSpec);
    expect(categorized[0].kind).toBe('function');
    expect(categorized[0].severity).toBe('high');
    expect(categorized[1].kind).toBe('variable');
    expect(categorized[1].severity).toBe('medium');
  });
});

describe('recommendSemverBump', () => {
  test('recommends major for breaking changes', () => {
    const diff: SpecDiff = { breaking: ['foo'], nonBreaking: [], docsOnly: [] };
    const rec = recommendSemverBump(diff);
    expect(rec.bump).toBe('major');
    expect(rec.breakingCount).toBe(1);
  });

  test('recommends minor for non-breaking additions', () => {
    const diff: SpecDiff = { breaking: [], nonBreaking: ['foo'], docsOnly: [] };
    const rec = recommendSemverBump(diff);
    expect(rec.bump).toBe('minor');
    expect(rec.additionCount).toBe(1);
  });

  test('recommends patch for docs-only changes', () => {
    const diff: SpecDiff = { breaking: [], nonBreaking: [], docsOnly: ['foo'] };
    const rec = recommendSemverBump(diff);
    expect(rec.bump).toBe('patch');
    expect(rec.docsOnlyChanges).toBe(true);
  });

  test('recommends none for no changes', () => {
    const diff: SpecDiff = { breaking: [], nonBreaking: [], docsOnly: [] };
    const rec = recommendSemverBump(diff);
    expect(rec.bump).toBe('none');
  });

  test('major takes priority over minor', () => {
    const diff: SpecDiff = { breaking: ['a'], nonBreaking: ['b'], docsOnly: [] };
    const rec = recommendSemverBump(diff);
    expect(rec.bump).toBe('major');
  });

  test('minor takes priority over patch', () => {
    const diff: SpecDiff = { breaking: [], nonBreaking: ['a'], docsOnly: ['b'] };
    const rec = recommendSemverBump(diff);
    expect(rec.bump).toBe('minor');
  });

  test('reason includes count', () => {
    const diff: SpecDiff = { breaking: ['a', 'b'], nonBreaking: [], docsOnly: [] };
    const rec = recommendSemverBump(diff);
    expect(rec.reason).toContain('2 breaking changes');
  });

  test('reason uses singular for single change', () => {
    const diff: SpecDiff = { breaking: ['a'], nonBreaking: [], docsOnly: [] };
    const rec = recommendSemverBump(diff);
    expect(rec.reason).toContain('1 breaking change detected');
  });
});

describe('calculateNextVersion', () => {
  test('increments major version', () => {
    expect(calculateNextVersion('1.2.3', 'major')).toBe('2.0.0');
  });

  test('increments minor version', () => {
    expect(calculateNextVersion('1.2.3', 'minor')).toBe('1.3.0');
  });

  test('increments patch version', () => {
    expect(calculateNextVersion('1.2.3', 'patch')).toBe('1.2.4');
  });

  test('returns same version for none', () => {
    expect(calculateNextVersion('1.2.3', 'none')).toBe('1.2.3');
  });

  test('handles v prefix', () => {
    expect(calculateNextVersion('v1.2.3', 'major')).toBe('v2.0.0');
    expect(calculateNextVersion('v1.2.3', 'minor')).toBe('v1.3.0');
    expect(calculateNextVersion('v1.2.3', 'patch')).toBe('v1.2.4');
  });

  test('handles 0.x versions', () => {
    expect(calculateNextVersion('0.1.0', 'major')).toBe('1.0.0');
    expect(calculateNextVersion('0.1.0', 'minor')).toBe('0.2.0');
    expect(calculateNextVersion('0.1.0', 'patch')).toBe('0.1.1');
  });

  test('returns as-is for unparseable version', () => {
    expect(calculateNextVersion('not-a-version', 'major')).toBe('not-a-version');
  });

  test('resets minor and patch on major bump', () => {
    expect(calculateNextVersion('5.9.8', 'major')).toBe('6.0.0');
  });

  test('resets patch on minor bump', () => {
    expect(calculateNextVersion('1.5.9', 'minor')).toBe('1.6.0');
  });
});
