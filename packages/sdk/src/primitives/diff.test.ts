import { describe, expect, test } from 'bun:test';
import type { OpenPkg } from '@openpkg-ts/spec';
import { type DiffOptions, diffSpec } from './diff';

describe('diff re-exports', () => {
  test('DiffOptions import works from SDK', () => {
    const options: DiffOptions = {
      includeDocsOnly: false,
      kinds: ['function'],
    };
    expect(options.includeDocsOnly).toBe(false);
    expect(options.kinds).toEqual(['function']);
  });

  test('diffSpec with options works from SDK', () => {
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
});
