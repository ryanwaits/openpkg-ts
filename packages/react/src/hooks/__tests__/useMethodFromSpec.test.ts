import { describe, expect, test } from 'bun:test';
import type { OpenPkg, SpecExport, SpecSignatureParameter } from '@openpkg-ts/spec';
import { extractMethodData, type MethodData } from '../useMethodFromSpec';

// =============================================================================
// Test Helpers
// =============================================================================

function makeSpec(exports: SpecExport[]): OpenPkg {
  return {
    openpkg: '0.4.0',
    meta: { name: '@test/pkg', version: '1.0.0' },
    exports,
  };
}

function makeExport(overrides: Partial<SpecExport> & { name: string }): SpecExport {
  return {
    id: overrides.name,
    kind: 'function',
    ...overrides,
  };
}

function makeParam(overrides: Partial<SpecSignatureParameter> & { name: string }): SpecSignatureParameter {
  return {
    required: true,
    schema: { type: 'string' },
    ...overrides,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('extractMethodData', () => {
  describe('title extraction', () => {
    test('adds parens for functions', () => {
      const exp = makeExport({ name: 'createUser', kind: 'function' });
      const spec = makeSpec([exp]);
      const result = extractMethodData(exp, spec);
      expect(result.title).toBe('createUser()');
    });

    test('no parens for non-functions', () => {
      const exp = makeExport({ name: 'UserConfig', kind: 'interface' });
      const spec = makeSpec([exp]);
      const result = extractMethodData(exp, spec);
      expect(result.title).toBe('UserConfig');
    });
  });

  describe('description extraction', () => {
    test('uses export description', () => {
      const exp = makeExport({
        name: 'foo',
        description: 'Export level description',
      });
      const spec = makeSpec([exp]);
      const result = extractMethodData(exp, spec);
      expect(result.description).toBe('Export level description');
    });

    test('falls back to signature description', () => {
      const exp = makeExport({
        name: 'foo',
        signatures: [{ description: 'Signature level description' }],
      });
      const spec = makeSpec([exp]);
      const result = extractMethodData(exp, spec);
      expect(result.description).toBe('Signature level description');
    });

    test('prefers export description over signature', () => {
      const exp = makeExport({
        name: 'foo',
        description: 'Export level',
        signatures: [{ description: 'Signature level' }],
      });
      const spec = makeSpec([exp]);
      const result = extractMethodData(exp, spec);
      expect(result.description).toBe('Export level');
    });
  });

  describe('parameter extraction', () => {
    test('extracts parameters from first signature', () => {
      const exp = makeExport({
        name: 'foo',
        signatures: [
          {
            parameters: [
              makeParam({ name: 'name' }),
              makeParam({ name: 'options', required: false }),
            ],
          },
        ],
      });
      const spec = makeSpec([exp]);
      const result = extractMethodData(exp, spec);
      expect(result.parameters).toHaveLength(2);
      expect(result.parameters[0].name).toBe('name');
      expect(result.parameters[1].name).toBe('options');
    });

    test('returns empty array when no signatures', () => {
      const exp = makeExport({ name: 'foo' });
      const spec = makeSpec([exp]);
      const result = extractMethodData(exp, spec);
      expect(result.parameters).toEqual([]);
    });

    test('returns empty array when no parameters', () => {
      const exp = makeExport({
        name: 'foo',
        signatures: [{}],
      });
      const spec = makeSpec([exp]);
      const result = extractMethodData(exp, spec);
      expect(result.parameters).toEqual([]);
    });
  });

  describe('example extraction', () => {
    test('extracts examples from export', () => {
      const exp = makeExport({
        name: 'foo',
        examples: [{ code: 'foo()' }],
      });
      const spec = makeSpec([exp]);
      const result = extractMethodData(exp, spec);
      expect(result.examples).toHaveLength(1);
      expect(result.examples[0].code).toBe('foo()');
    });

    test('extracts examples from signature', () => {
      const exp = makeExport({
        name: 'foo',
        signatures: [
          {
            examples: [{ code: 'bar()' }],
          },
        ],
      });
      const spec = makeSpec([exp]);
      const result = extractMethodData(exp, spec);
      expect(result.examples).toHaveLength(1);
      expect(result.examples[0].code).toBe('bar()');
    });

    test('converts string examples to SpecExample', () => {
      const exp = makeExport({
        name: 'foo',
        examples: ['simple code'],
      });
      const spec = makeSpec([exp]);
      const result = extractMethodData(exp, spec);
      expect(result.examples).toHaveLength(1);
      expect(result.examples[0].code).toBe('simple code');
    });

    test('returns empty array when no examples', () => {
      const exp = makeExport({ name: 'foo' });
      const spec = makeSpec([exp]);
      const result = extractMethodData(exp, spec);
      expect(result.examples).toEqual([]);
    });
  });

  describe('return type extraction', () => {
    test('extracts return type schema', () => {
      const exp = makeExport({
        name: 'foo',
        signatures: [
          {
            returns: {
              schema: { type: 'string' },
              description: 'The result',
            },
          },
        ],
      });
      const spec = makeSpec([exp]);
      const result = extractMethodData(exp, spec);
      expect(result.returnType).toEqual({ type: 'string' });
      expect(result.returnDescription).toBe('The result');
    });

    test('handles missing return type', () => {
      const exp = makeExport({ name: 'foo' });
      const spec = makeSpec([exp]);
      const result = extractMethodData(exp, spec);
      expect(result.returnType).toBeUndefined();
      expect(result.returnTypeString).toBeUndefined();
    });
  });

  describe('async detection', () => {
    test('detects async flag', () => {
      const exp = makeExport({
        name: 'foo',
        flags: { async: true },
      });
      const spec = makeSpec([exp]);
      const result = extractMethodData(exp, spec);
      expect(result.isAsync).toBe(true);
    });

    test('returns false when not async', () => {
      const exp = makeExport({
        name: 'foo',
        flags: { async: false },
      });
      const spec = makeSpec([exp]);
      const result = extractMethodData(exp, spec);
      expect(result.isAsync).toBe(false);
    });

    test('returns false when no flags', () => {
      const exp = makeExport({ name: 'foo' });
      const spec = makeSpec([exp]);
      const result = extractMethodData(exp, spec);
      expect(result.isAsync).toBe(false);
    });
  });

  describe('export reference', () => {
    test('includes original export in result', () => {
      const exp = makeExport({ name: 'foo' });
      const spec = makeSpec([exp]);
      const result = extractMethodData(exp, spec);
      expect(result.export).toBe(exp);
    });
  });
});
