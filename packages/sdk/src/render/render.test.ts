import { describe, expect, test } from 'bun:test';
import type { OpenPkg } from '@openpkg-ts/spec';
import { toHTML } from './html';
import { toJSON, type SimplifiedSpec } from './json';
import { toMarkdown } from './markdown';

const mockSpec: OpenPkg = {
  meta: { name: 'test-pkg', version: '1.0.0', description: 'Test package' },
  exports: [
    { id: 'fn-greet', name: 'greet', kind: 'function', signatures: [] },
    { id: 'fn-hello', name: 'hello', kind: 'function', signatures: [] },
    { id: 'cls-user', name: 'User', kind: 'class', signatures: [] },
  ],
  types: [],
};

describe('toJSON exports[]', () => {
  test('filters to single export', () => {
    const result = toJSON(mockSpec, { exports: ['greet'] }) as SimplifiedSpec;
    expect(result.exports).toHaveLength(1);
    expect(result.exports[0].name).toBe('greet');
  });

  test('filters to multiple exports', () => {
    const result = toJSON(mockSpec, { exports: ['greet', 'User'] }) as SimplifiedSpec;
    expect(result.exports).toHaveLength(2);
    expect(result.exports.map((e) => e.name).sort()).toEqual(['User', 'greet']);
  });

  test('empty exports[] returns empty list', () => {
    const result = toJSON(mockSpec, { exports: [] }) as SimplifiedSpec;
    expect(result.exports).toHaveLength(3);
  });

  test('unknown ID ignored', () => {
    const result = toJSON(mockSpec, { exports: ['greet', 'unknown'] }) as SimplifiedSpec;
    expect(result.exports).toHaveLength(1);
    expect(result.exports[0].name).toBe('greet');
  });

  test('export takes precedence over exports[]', () => {
    const result = toJSON(mockSpec, { export: 'hello', exports: ['greet'] });
    expect(result).toHaveProperty('name', 'hello');
  });
});

describe('toMarkdown exports[]', () => {
  test('filters to multiple exports', () => {
    const result = toMarkdown(mockSpec, { exports: ['greet', 'User'], frontmatter: false });
    expect(result).toContain('greet');
    expect(result).toContain('User');
    expect(result).not.toContain('hello');
  });

  test('maintains heading structure', () => {
    const result = toMarkdown(mockSpec, { exports: ['greet'], frontmatter: false });
    expect(result).toContain('## Function');
  });

  test('empty match returns empty markdown', () => {
    const result = toMarkdown(mockSpec, { exports: ['unknown'] });
    expect(result).toBe('');
  });
});

describe('toHTML exports[]', () => {
  test('filters to multiple exports', () => {
    const result = toHTML(mockSpec, { exports: ['greet', 'User'], fullDocument: false });
    expect(result).toContain('greet');
    expect(result).toContain('User');
    expect(result).not.toContain('hello');
  });
});
