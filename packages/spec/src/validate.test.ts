import { describe, expect, test } from 'bun:test';
import type { OpenPkg } from './types';
import {
  assertSpec,
  getAvailableVersions,
  getValidationErrors,
  LATEST_VERSION,
  validateSpec,
} from './validate';

const validSpec: OpenPkg = {
  openpkg: '0.4.0',
  meta: { name: 'test-pkg' },
  exports: [{ id: 'foo', name: 'foo', kind: 'function' }],
};

const minimalSpec: OpenPkg = {
  openpkg: '0.4.0',
  meta: { name: 'minimal' },
  exports: [],
};

describe('validateSpec', () => {
  test('returns ok:true for valid spec', () => {
    const result = validateSpec(validSpec);
    expect(result.ok).toBe(true);
  });

  test('returns ok:true for minimal valid spec', () => {
    const result = validateSpec(minimalSpec);
    expect(result.ok).toBe(true);
  });

  test('returns ok:false when missing required fields', () => {
    const result = validateSpec({});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.length).toBeGreaterThan(0);
    }
  });

  test('returns ok:false when meta.name missing', () => {
    const result = validateSpec({
      openpkg: '0.4.0',
      meta: {},
      exports: [],
    });
    expect(result.ok).toBe(false);
  });

  test('returns ok:false when exports missing', () => {
    const result = validateSpec({
      openpkg: '0.4.0',
      meta: { name: 'test' },
    });
    expect(result.ok).toBe(false);
  });

  test('returns ok:false for invalid export kind', () => {
    const result = validateSpec({
      openpkg: '0.4.0',
      meta: { name: 'test' },
      exports: [{ id: 'x', name: 'x', kind: 'invalid-kind' }],
    });
    expect(result.ok).toBe(false);
  });

  test('validates against specific version', () => {
    const result = validateSpec(validSpec, '0.4.0');
    expect(result.ok).toBe(true);
  });

  test('validates against latest version', () => {
    const result = validateSpec(validSpec, 'latest');
    expect(result.ok).toBe(true);
  });

  test('throws for unknown schema version', () => {
    expect(() => {
      // @ts-expect-error testing invalid version
      validateSpec(validSpec, '9.9.9');
    }).toThrow('Unknown schema version');
  });

  test('validates spec with types array', () => {
    const specWithTypes: OpenPkg = {
      ...validSpec,
      types: [{ id: 'MyType', name: 'MyType', kind: 'interface' }],
    };
    const result = validateSpec(specWithTypes);
    expect(result.ok).toBe(true);
  });

  test('validates spec with generation metadata', () => {
    const specWithGen: OpenPkg = {
      ...validSpec,
      generation: {
        generator: 'test@1.0.0',
        timestamp: '2024-01-01T00:00:00Z',
      },
    };
    const result = validateSpec(specWithGen);
    expect(result.ok).toBe(true);
  });

  test('validates all export kinds', () => {
    const kinds = [
      'function',
      'class',
      'variable',
      'interface',
      'type',
      'enum',
      'module',
      'namespace',
      'reference',
      'external',
    ] as const;
    for (const kind of kinds) {
      const spec: OpenPkg = {
        openpkg: '0.4.0',
        meta: { name: 'test' },
        exports: [{ id: `test-${kind}`, name: `Test${kind}`, kind }],
      };
      const result = validateSpec(spec);
      expect(result.ok).toBe(true);
    }
  });
});

describe('assertSpec', () => {
  test('does not throw for valid spec', () => {
    expect(() => assertSpec(validSpec)).not.toThrow();
  });

  test('throws for invalid spec with details', () => {
    expect(() => assertSpec({})).toThrow('Invalid OpenPkg spec');
  });

  test('error message includes field paths', () => {
    try {
      assertSpec({ openpkg: '0.4.0', meta: {}, exports: [] });
    } catch (e) {
      expect((e as Error).message).toContain('/meta');
    }
  });
});

describe('getValidationErrors', () => {
  test('returns empty array for valid spec', () => {
    const errors = getValidationErrors(validSpec);
    expect(errors).toEqual([]);
  });

  test('returns errors array for invalid spec', () => {
    const errors = getValidationErrors({});
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toHaveProperty('instancePath');
    expect(errors[0]).toHaveProperty('message');
    expect(errors[0]).toHaveProperty('keyword');
  });

  test('errors have proper structure', () => {
    const errors = getValidationErrors({ openpkg: '0.4.0' });
    for (const err of errors) {
      expect(typeof err.instancePath).toBe('string');
      expect(typeof err.message).toBe('string');
      expect(typeof err.keyword).toBe('string');
    }
  });
});

describe('getAvailableVersions', () => {
  test('returns array of version strings', () => {
    const versions = getAvailableVersions();
    expect(Array.isArray(versions)).toBe(true);
    expect(versions.length).toBeGreaterThan(0);
  });

  test('includes latest version', () => {
    const versions = getAvailableVersions();
    expect(versions).toContain(LATEST_VERSION);
  });

  test('includes known versions', () => {
    const versions = getAvailableVersions();
    expect(versions).toContain('0.1.0');
    expect(versions).toContain('0.2.0');
    expect(versions).toContain('0.3.0');
    expect(versions).toContain('0.4.0');
  });
});

describe('LATEST_VERSION', () => {
  test('is a valid version string', () => {
    expect(LATEST_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  test('is 0.4.0', () => {
    expect(LATEST_VERSION).toBe('0.4.0');
  });
});

describe('wire-format schema constraints (v0.4.0)', () => {
  const withSchema = (schema: unknown): OpenPkg =>
    ({
      openpkg: '0.4.0',
      meta: { name: 'schema-test' },
      exports: [{ id: 'x', name: 'x', kind: 'variable', schema }],
    }) as OpenPkg;

  test('rejects bare-string schema shorthand', () => {
    expect(validateSpec(withSchema('string')).ok).toBe(false);
  });

  test('rejects non-JSON-Schema type values', () => {
    expect(validateSpec(withSchema({ type: 'tuple' })).ok).toBe(false);
    expect(validateSpec(withSchema({ type: 'undefined' })).ok).toBe(false);
    expect(validateSpec(withSchema({ type: 'function' })).ok).toBe(false);
  });

  test('accepts the seven JSON Schema primitive types', () => {
    for (const t of ['string', 'number', 'integer', 'boolean', 'object', 'array', 'null']) {
      expect(validateSpec(withSchema({ type: t })).ok).toBe(true);
    }
  });

  test('accepts 2020-12 array form of type', () => {
    expect(validateSpec(withSchema({ type: ['string', 'null'] })).ok).toBe(true);
  });

  test('accepts declared x-ts extensions', () => {
    expect(
      validateSpec(
        withSchema({
          type: 'object',
          'x-ts-type': 'Map<string, number>',
          'x-ts-type-arguments': [{ type: 'string' }, { type: 'number' }],
          'x-ts-package': 'some-lib',
        }),
      ).ok,
    ).toBe(true);
    expect(validateSpec(withSchema({ 'x-ts-function': true })).ok).toBe(true);
  });

  test('accepts tuples via prefixItems', () => {
    expect(
      validateSpec(
        withSchema({
          type: 'array',
          prefixItems: [{ type: 'string' }, { type: 'number' }],
          minItems: 2,
          maxItems: 2,
        }),
      ).ok,
    ).toBe(true);
  });

  test('accepts vendor schemas with $defs and patternProperties', () => {
    expect(
      validateSpec(
        withSchema({
          $ref: '#/$defs/Node',
          $defs: {
            Node: {
              type: 'object',
              title: 'Node',
              properties: { next: { $ref: '#/$defs/Node' } },
              patternProperties: { '^x-': { type: 'string' } },
            },
          },
        }),
      ).ok,
    ).toBe(true);
  });
});
