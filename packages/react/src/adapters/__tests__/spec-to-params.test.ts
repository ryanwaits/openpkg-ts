import { describe, expect, test } from 'bun:test';
import type { SpecSchema, SpecSignatureParameter } from '@openpkg-ts/spec';
import {
  specParamToNestedParam,
  specParamsToNestedParams,
  resolveSchemaRef,
} from '../spec-to-params';

// =============================================================================
// Test Helpers
// =============================================================================

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

describe('specParamToNestedParam', () => {
  describe('basic properties', () => {
    test('extracts name', () => {
      const param = makeParam({ name: 'userId' });
      const result = specParamToNestedParam(param);
      expect(result.name).toBe('userId');
    });

    test('extracts type from schema', () => {
      const param = makeParam({ name: 'count', schema: { type: 'number' } });
      const result = specParamToNestedParam(param);
      expect(result.type).toBe('number');
    });

    test('marks required params', () => {
      const param = makeParam({ name: 'name', required: true });
      const result = specParamToNestedParam(param);
      expect(result.required).toBe(true);
    });

    test('marks optional params', () => {
      const param = makeParam({ name: 'options', required: false });
      const result = specParamToNestedParam(param);
      expect(result.required).toBe(false);
    });

    test('extracts description', () => {
      const param = makeParam({ name: 'id', description: 'The unique identifier' });
      const result = specParamToNestedParam(param);
      expect(result.description).toBe('The unique identifier');
    });
  });

  describe('anchor generation', () => {
    test('generates anchorId from name', () => {
      const param = makeParam({ name: 'userId' });
      const result = specParamToNestedParam(param);
      expect(result.anchorId).toBe('userId');
    });

    test('includes parent path in anchorId', () => {
      const param = makeParam({ name: 'city' });
      const result = specParamToNestedParam(param, 'address.');
      expect(result.anchorId).toBe('address.city');
    });

    test('shows anchor when has parent path', () => {
      const param = makeParam({ name: 'city' });
      const result = specParamToNestedParam(param, 'address.');
      expect(result.showAnchor).toBe(true);
    });

    test('hides anchor for top-level params', () => {
      const param = makeParam({ name: 'name' });
      const result = specParamToNestedParam(param);
      expect(result.showAnchor).toBe(false);
    });
  });

  describe('nested object properties', () => {
    test('extracts children from object schema', () => {
      const param = makeParam({
        name: 'address',
        schema: {
          type: 'object',
          properties: {
            city: { type: 'string' },
            country: { type: 'string' },
          },
        },
      });
      const result = specParamToNestedParam(param);
      expect(result.children).toBeDefined();
      expect(result.children).toHaveLength(2);
    });

    test('sets type to object for nested params', () => {
      const param = makeParam({
        name: 'settings',
        schema: {
          type: 'object',
          properties: {
            theme: { type: 'string' },
          },
        },
      });
      const result = specParamToNestedParam(param);
      expect(result.type).toBe('object');
    });

    test('marks expandable when has children', () => {
      const param = makeParam({
        name: 'config',
        schema: {
          type: 'object',
          properties: {
            debug: { type: 'boolean' },
          },
        },
      });
      const result = specParamToNestedParam(param);
      expect(result.expandable).toBe(true);
    });

    test('not expandable for primitive types', () => {
      const param = makeParam({ name: 'name', schema: { type: 'string' } });
      const result = specParamToNestedParam(param);
      expect(result.expandable).toBe(false);
    });

    test('recursively processes nested objects', () => {
      const param = makeParam({
        name: 'user',
        schema: {
          type: 'object',
          properties: {
            profile: {
              type: 'object',
              properties: {
                avatar: { type: 'string' },
              },
            },
          },
        },
      });
      const result = specParamToNestedParam(param);
      expect(result.children?.[0].children).toBeDefined();
      expect(result.children?.[0].children?.[0].name).toBe('avatar');
    });

    test('handles required properties in nested object', () => {
      const param = makeParam({
        name: 'data',
        schema: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
          },
          required: ['id'],
        },
      });
      const result = specParamToNestedParam(param);
      const idChild = result.children?.find((c) => c.name === 'id');
      const nameChild = result.children?.find((c) => c.name === 'name');
      expect(idChild?.required).toBe(true);
      expect(nameChild?.required).toBe(false);
    });
  });

  describe('enum values', () => {
    test('extracts enum values', () => {
      const param = makeParam({
        name: 'theme',
        schema: {
          type: 'string',
          enum: ['light', 'dark', 'system'],
        },
      });
      const result = specParamToNestedParam(param);
      expect(result.enumValues).toBeDefined();
      expect(result.enumValues).toHaveLength(3);
    });

    test('formats enum values as strings', () => {
      const param = makeParam({
        name: 'priority',
        schema: {
          type: 'number',
          enum: [1, 2, 3],
        },
      });
      const result = specParamToNestedParam(param);
      expect(result.enumValues?.[0].value).toBe('1');
      expect(result.enumValues?.[1].value).toBe('2');
    });

    test('returns undefined when no enum', () => {
      const param = makeParam({ name: 'name' });
      const result = specParamToNestedParam(param);
      expect(result.enumValues).toBeUndefined();
    });
  });

  describe('schema preservation', () => {
    test('includes original schema', () => {
      const schema: SpecSchema = { type: 'boolean' };
      const param = makeParam({ name: 'active', schema });
      const result = specParamToNestedParam(param);
      expect(result.schema).toBe(schema);
    });
  });
});

describe('specParamsToNestedParams', () => {
  test('converts multiple params', () => {
    const params = [
      makeParam({ name: 'name' }),
      makeParam({ name: 'email' }),
      makeParam({ name: 'age', schema: { type: 'number' } }),
    ];
    const result = specParamsToNestedParams(params);
    expect(result).toHaveLength(3);
    expect(result[0].name).toBe('name');
    expect(result[1].name).toBe('email');
    expect(result[2].name).toBe('age');
  });

  test('returns empty array for empty input', () => {
    const result = specParamsToNestedParams([]);
    expect(result).toEqual([]);
  });
});

describe('resolveSchemaRef', () => {
  test('resolves $ref to type', () => {
    const schema: SpecSchema = { $ref: '#/$defs/UserConfig' };
    const types: Record<string, SpecSchema> = {
      UserConfig: { type: 'object', properties: { theme: { type: 'string' } } },
    };
    const result = resolveSchemaRef(schema, types);
    expect(result).toBe(types.UserConfig);
  });

  test('resolves #/types/ refs', () => {
    const schema: SpecSchema = { $ref: '#/types/Options' };
    const types: Record<string, SpecSchema> = {
      Options: { type: 'object' },
    };
    const result = resolveSchemaRef(schema, types);
    expect(result).toBe(types.Options);
  });

  test('returns original when ref not found', () => {
    const schema: SpecSchema = { $ref: '#/$defs/Unknown' };
    const types: Record<string, SpecSchema> = {};
    const result = resolveSchemaRef(schema, types);
    expect(result).toBe(schema);
  });

  test('returns schema when no ref', () => {
    const schema: SpecSchema = { type: 'string' };
    const types: Record<string, SpecSchema> = {};
    const result = resolveSchemaRef(schema, types);
    expect(result).toBe(schema);
  });

  test('handles undefined schema', () => {
    const result = resolveSchemaRef(undefined as unknown as SpecSchema, {});
    expect(result).toBeUndefined();
  });
});
