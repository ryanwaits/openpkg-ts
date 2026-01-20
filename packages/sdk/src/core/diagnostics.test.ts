import { describe, expect, it } from 'bun:test';
import type { OpenPkg, SpecExport } from '@openpkg-ts/spec';
import {
  analyzeSpec,
  findMissingParamDocs,
  getDeprecationMessage,
  hasDeprecatedTag,
} from './diagnostics';

const makeSpec = (exports: SpecExport[]): OpenPkg => ({
  openpkg: '0.4.0',
  meta: { name: 'test-pkg' },
  exports,
});

describe('hasDeprecatedTag', () => {
  it('returns true for deprecated: true', () => {
    const exp: SpecExport = { id: 'a', name: 'a', kind: 'function', deprecated: true };
    expect(hasDeprecatedTag(exp)).toBe(true);
  });

  it('returns true for @deprecated tag', () => {
    const exp: SpecExport = {
      id: 'a',
      name: 'a',
      kind: 'function',
      tags: [{ name: '@deprecated', text: 'Use something else' }],
    };
    expect(hasDeprecatedTag(exp)).toBe(true);
  });

  it('returns false without deprecated marker', () => {
    const exp: SpecExport = { id: 'a', name: 'a', kind: 'function' };
    expect(hasDeprecatedTag(exp)).toBe(false);
  });
});

describe('getDeprecationMessage', () => {
  it('returns undefined when no reason', () => {
    const exp: SpecExport = {
      id: 'a',
      name: 'a',
      kind: 'function',
      deprecated: true,
    };
    expect(getDeprecationMessage(exp)).toBeUndefined();
  });

  it('returns message from @deprecated tag', () => {
    const exp: SpecExport = {
      id: 'a',
      name: 'a',
      kind: 'function',
      tags: [{ name: '@deprecated', text: 'Use newFunc instead' }],
    };
    expect(getDeprecationMessage(exp)).toBe('Use newFunc instead');
  });

  it('returns undefined for empty text', () => {
    const exp: SpecExport = {
      id: 'a',
      name: 'a',
      kind: 'function',
      tags: [{ name: '@deprecated', text: '  ' }],
    };
    expect(getDeprecationMessage(exp)).toBeUndefined();
  });
});

describe('findMissingParamDocs', () => {
  it('finds params without descriptions', () => {
    const exp: SpecExport = {
      id: 'a',
      name: 'a',
      kind: 'function',
      signatures: [
        {
          parameters: [
            { name: 'foo', schema: { type: 'string' } },
            { name: 'bar', description: 'has desc', schema: { type: 'number' } },
            { name: 'baz', description: '', schema: { type: 'boolean' } },
          ],
        },
      ],
    };
    expect(findMissingParamDocs(exp)).toEqual(['foo', 'baz']);
  });

  it('returns empty for no signatures', () => {
    const exp: SpecExport = { id: 'a', name: 'a', kind: 'function' };
    expect(findMissingParamDocs(exp)).toEqual([]);
  });
});

describe('analyzeSpec', () => {
  it('finds missing descriptions', () => {
    const spec = makeSpec([
      { id: 'a', name: 'noDesc', kind: 'function' },
      { id: 'b', name: 'hasDesc', kind: 'function', description: 'Something' },
    ]);
    const result = analyzeSpec(spec);
    expect(result.missingDescriptions).toHaveLength(1);
    expect(result.missingDescriptions[0].exportName).toBe('noDesc');
  });

  it('finds member missing descriptions', () => {
    const spec = makeSpec([
      {
        id: 'a',
        name: 'MyClass',
        kind: 'class',
        description: 'A class',
        members: [
          { name: 'noDesc', kind: 'property' },
          { name: 'hasDesc', kind: 'property', description: 'prop desc' },
        ],
      },
    ]);
    const result = analyzeSpec(spec);
    expect(result.missingDescriptions).toHaveLength(1);
    expect(result.missingDescriptions[0].member).toBe('noDesc');
  });

  it('finds deprecated without reason', () => {
    const spec = makeSpec([
      { id: 'a', name: 'depNoReason', kind: 'function', deprecated: true },
      {
        id: 'b',
        name: 'depWithReason',
        kind: 'function',
        deprecated: true,
        tags: [{ name: '@deprecated', text: 'Use other' }],
      },
    ]);
    const result = analyzeSpec(spec);
    expect(result.deprecatedNoReason).toHaveLength(1);
    expect(result.deprecatedNoReason[0].exportName).toBe('depNoReason');
  });

  it('finds missing param docs', () => {
    const spec = makeSpec([
      {
        id: 'a',
        name: 'fn',
        kind: 'function',
        description: 'A function',
        signatures: [
          {
            parameters: [
              { name: 'x', schema: { type: 'string' } },
              { name: 'y', description: 'y desc', schema: { type: 'number' } },
            ],
          },
        ],
      },
    ]);
    const result = analyzeSpec(spec);
    expect(result.missingParamDocs).toHaveLength(1);
    expect(result.missingParamDocs[0].param).toBe('x');
  });
});
