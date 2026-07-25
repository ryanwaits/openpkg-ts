import { describe, expect, test } from 'bun:test';
import type { SpecExport, SpecMember, SpecSchema, SpecType } from '@openpkg-ts/spec';
import {
  normalizeExport,
  normalizeMembers,
  normalizeSchema,
  normalizeType,
} from './schema-normalizer';

describe('normalizeSchema', () => {
  describe('primitive type normalization', () => {
    test('void → null with x-ts-type', () => {
      const input: SpecSchema = { type: 'void' };
      const result = normalizeSchema(input);
      expect(result).toEqual({ type: 'null', 'x-ts-type': 'void' });
    });

    test('never → not {}', () => {
      const input: SpecSchema = { type: 'never' };
      const result = normalizeSchema(input);
      expect(result).toEqual({ not: {} });
    });

    test('any → {}', () => {
      const input: SpecSchema = { type: 'any' };
      const result = normalizeSchema(input);
      expect(result).toEqual({});
    });

    test('unknown → x-ts-type extension only', () => {
      const input: SpecSchema = { type: 'unknown' };
      const result = normalizeSchema(input);
      expect(result).toEqual({ 'x-ts-type': 'unknown' });
    });

    test('undefined → null', () => {
      const input: SpecSchema = { type: 'undefined' };
      const result = normalizeSchema(input);
      expect(result).toEqual({ type: 'null' });
    });

    test('bigint → integer with x-ts-type', () => {
      const input: SpecSchema = { type: 'bigint' };
      const result = normalizeSchema(input);
      expect(result).toEqual({ type: 'integer', 'x-ts-type': 'bigint' });
    });

    test('symbol → string with x-ts-type', () => {
      const input: SpecSchema = { type: 'symbol' };
      const result = normalizeSchema(input);
      expect(result).toEqual({ type: 'string', 'x-ts-type': 'symbol' });
    });

    test('preserves description on primitive types', () => {
      const input: SpecSchema = { type: 'void', description: 'Returns nothing' } as SpecSchema;
      const result = normalizeSchema(input);
      expect(result).toEqual({ type: 'null', 'x-ts-type': 'void', description: 'Returns nothing' });
    });
  });

  describe('standard JSON Schema types', () => {
    test('string passes through', () => {
      const input: SpecSchema = { type: 'string' };
      const result = normalizeSchema(input);
      expect(result).toEqual({ type: 'string' });
    });

    test('number passes through', () => {
      const input: SpecSchema = { type: 'number' };
      const result = normalizeSchema(input);
      expect(result).toEqual({ type: 'number' });
    });

    test('boolean passes through', () => {
      const input: SpecSchema = { type: 'boolean' };
      const result = normalizeSchema(input);
      expect(result).toEqual({ type: 'boolean' });
    });

    test('integer passes through', () => {
      const input: SpecSchema = { type: 'integer' };
      const result = normalizeSchema(input);
      expect(result).toEqual({ type: 'integer' });
    });

    test('null passes through', () => {
      const input: SpecSchema = { type: 'null' };
      const result = normalizeSchema(input);
      expect(result).toEqual({ type: 'null' });
    });

    test('preserves enum', () => {
      const input: SpecSchema = { type: 'string', enum: ['a', 'b', 'c'] };
      const result = normalizeSchema(input);
      expect(result).toEqual({ type: 'string', enum: ['a', 'b', 'c'] });
    });

    test('preserves format', () => {
      const input: SpecSchema = { type: 'string', format: 'date-time' };
      const result = normalizeSchema(input);
      expect(result).toEqual({ type: 'string', format: 'date-time' });
    });
  });

  describe('function type normalization', () => {
    test('function → x-ts-function with signatures', () => {
      const input: SpecSchema = {
        type: 'function',
        signatures: [
          {
            parameters: [{ name: 'x', schema: { type: 'number' }, required: true }],
            returns: { schema: { type: 'string' } },
          },
        ],
      };
      const result = normalizeSchema(input);
      expect(result).toEqual({
        'x-ts-function': true,
        'x-ts-signatures': [
          {
            parameters: [{ name: 'x', schema: { type: 'number' }, required: true }],
            returns: { schema: { type: 'string' } },
          },
        ],
      });
    });

    test('normalizes nested schemas in function signatures', () => {
      const input: SpecSchema = {
        type: 'function',
        signatures: [
          {
            parameters: [{ name: 'x', schema: { type: 'bigint' }, required: true }],
            returns: { schema: { type: 'void' } },
          },
        ],
      };
      const result = normalizeSchema(input);
      expect(result).toEqual({
        'x-ts-function': true,
        'x-ts-signatures': [
          {
            parameters: [
              { name: 'x', schema: { type: 'integer', 'x-ts-type': 'bigint' }, required: true },
            ],
            returns: { schema: { type: 'null', 'x-ts-type': 'void' } },
          },
        ],
      });
    });

    test('preserves function description', () => {
      const input: SpecSchema = {
        type: 'function',
        description: 'A callback function',
        signatures: [],
      };
      const result = normalizeSchema(input);
      expect(result).toEqual({
        'x-ts-function': true,
        'x-ts-signatures': [],
        description: 'A callback function',
      });
    });
  });

  describe('$ref + typeArguments normalization', () => {
    test('$ref without typeArguments passes through', () => {
      const input: SpecSchema = { $ref: '#/types/MyType' };
      const result = normalizeSchema(input);
      expect(result).toEqual({ $ref: '#/types/MyType' });
    });

    test('$ref with typeArguments → x-ts-type-arguments', () => {
      const input: SpecSchema = {
        $ref: '#/types/Promise',
        typeArguments: [{ type: 'string' }],
      };
      const result = normalizeSchema(input);
      expect(result).toEqual({
        $ref: '#/types/Promise',
        'x-ts-type-arguments': [{ type: 'string' }],
      });
    });

    test('normalizes nested typeArguments', () => {
      const input: SpecSchema = {
        $ref: '#/types/Map',
        typeArguments: [{ type: 'symbol' }, { type: 'bigint' }],
      };
      const result = normalizeSchema(input);
      expect(result).toEqual({
        $ref: '#/types/Map',
        'x-ts-type-arguments': [
          { type: 'string', 'x-ts-type': 'symbol' },
          { type: 'integer', 'x-ts-type': 'bigint' },
        ],
      });
    });
  });

  describe('tuple normalization', () => {
    test('tuple with items array → prefixItems', () => {
      const input: SpecSchema = {
        type: 'tuple',
        items: [{ type: 'string' }, { type: 'number' }],
      };
      const result = normalizeSchema(input);
      expect(result).toEqual({
        type: 'array',
        prefixItems: [{ type: 'string' }, { type: 'number' }],
        minItems: 2,
        maxItems: 2,
      });
    });

    test('preserves existing prefixItems', () => {
      const input: SpecSchema = {
        type: 'array',
        prefixItems: [{ type: 'string' }, { type: 'number' }],
        minItems: 2,
        maxItems: 2,
      };
      const result = normalizeSchema(input);
      expect(result).toEqual({
        type: 'array',
        prefixItems: [{ type: 'string' }, { type: 'number' }],
        minItems: 2,
        maxItems: 2,
      });
    });

    test('rewrites legacy prefixedItems misspelling to prefixItems', () => {
      const input: SpecSchema = {
        type: 'array',
        prefixedItems: [{ type: 'string' }, { type: 'number' }],
        minItems: 2,
        maxItems: 2,
      } as SpecSchema;
      const result = normalizeSchema(input);
      expect(result).toEqual({
        type: 'array',
        prefixItems: [{ type: 'string' }, { type: 'number' }],
        minItems: 2,
        maxItems: 2,
      });
    });

    test('legacy prefixedItems on tuple type rewrites to prefixItems', () => {
      const input: SpecSchema = {
        type: 'tuple',
        prefixedItems: [{ type: 'string' }],
        minItems: 1,
        maxItems: 1,
      } as SpecSchema;
      const result = normalizeSchema(input);
      expect(result).toEqual({
        type: 'array',
        prefixItems: [{ type: 'string' }],
        minItems: 1,
        maxItems: 1,
      });
    });

    test('normalizes nested schemas in tuples', () => {
      const input: SpecSchema = {
        type: 'tuple',
        items: [{ type: 'bigint' }, { type: 'symbol' }],
      };
      const result = normalizeSchema(input);
      expect(result).toEqual({
        type: 'array',
        prefixItems: [
          { type: 'integer', 'x-ts-type': 'bigint' },
          { type: 'string', 'x-ts-type': 'symbol' },
        ],
        minItems: 2,
        maxItems: 2,
      });
    });
  });

  describe('array normalization', () => {
    test('array with items passes through', () => {
      const input: SpecSchema = {
        type: 'array',
        items: { type: 'string' },
      };
      const result = normalizeSchema(input);
      expect(result).toEqual({
        type: 'array',
        items: { type: 'string' },
      });
    });

    test('normalizes items schema', () => {
      const input: SpecSchema = {
        type: 'array',
        items: { type: 'bigint' },
      };
      const result = normalizeSchema(input);
      expect(result).toEqual({
        type: 'array',
        items: { type: 'integer', 'x-ts-type': 'bigint' },
      });
    });

    test('preserves uniqueItems, contains, title, default', () => {
      const input = {
        type: 'array',
        items: { type: 'string' },
        uniqueItems: true,
        contains: { type: 'string', enum: ['a'] },
        title: 'Tags',
        default: [],
      } as unknown as SpecSchema;
      const result = normalizeSchema(input);
      expect(result).toEqual({
        type: 'array',
        items: { type: 'string' },
        uniqueItems: true,
        contains: { type: 'string', enum: ['a'] },
        title: 'Tags',
        default: [],
      });
    });
  });

  describe('object normalization', () => {
    test('object with properties passes through', () => {
      const input: SpecSchema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
        },
        required: ['name'],
      };
      const result = normalizeSchema(input);
      expect(result).toEqual({
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
        },
        required: ['name'],
      });
    });

    test('normalizes nested property schemas', () => {
      const input: SpecSchema = {
        type: 'object',
        properties: {
          id: { type: 'bigint' },
          sym: { type: 'symbol' },
        },
      };
      const result = normalizeSchema(input);
      expect(result).toEqual({
        type: 'object',
        properties: {
          id: { type: 'integer', 'x-ts-type': 'bigint' },
          sym: { type: 'string', 'x-ts-type': 'symbol' },
        },
      });
    });

    test('preserves $defs, patternProperties, propertyNames, title, default', () => {
      const input = {
        type: 'object',
        properties: { next: { $ref: '#/$defs/Node' } },
        $defs: { Node: { type: 'object', properties: { v: { type: 'bigint' } } } },
        patternProperties: { '^x-': { type: 'symbol' } },
        propertyNames: { type: 'string', pattern: '^[a-z]' },
        title: 'Node',
        default: {},
        minProperties: 1,
        maxProperties: 8,
      } as unknown as SpecSchema;
      const result = normalizeSchema(input);
      expect(result).toEqual({
        type: 'object',
        properties: { next: { $ref: '#/$defs/Node' } },
        $defs: {
          Node: {
            type: 'object',
            properties: { v: { type: 'integer', 'x-ts-type': 'bigint' } },
          },
        },
        patternProperties: { '^x-': { type: 'string', 'x-ts-type': 'symbol' } },
        propertyNames: { type: 'string', pattern: '^[a-z]' },
        title: 'Node',
        default: {},
        minProperties: 1,
        maxProperties: 8,
      });
    });

    test('normalizes additionalProperties schema', () => {
      const input: SpecSchema = {
        type: 'object',
        additionalProperties: { type: 'bigint' },
      };
      const result = normalizeSchema(input);
      expect(result).toEqual({
        type: 'object',
        additionalProperties: { type: 'integer', 'x-ts-type': 'bigint' },
      });
    });
  });

  describe('combinator normalization', () => {
    test('anyOf recursively normalizes', () => {
      const input: SpecSchema = {
        anyOf: [{ type: 'string' }, { type: 'void' }, { type: 'never' }],
      };
      const result = normalizeSchema(input);
      expect(result).toEqual({
        anyOf: [{ type: 'string' }, { type: 'null', 'x-ts-type': 'void' }, { not: {} }],
      });
    });

    test('allOf recursively normalizes', () => {
      const input: SpecSchema = {
        allOf: [{ type: 'bigint' }, { type: 'symbol' }],
      };
      const result = normalizeSchema(input);
      expect(result).toEqual({
        allOf: [
          { type: 'integer', 'x-ts-type': 'bigint' },
          { type: 'string', 'x-ts-type': 'symbol' },
        ],
      });
    });

    test('oneOf recursively normalizes', () => {
      const input: SpecSchema = {
        oneOf: [{ type: 'any' }, { type: 'unknown' }],
      };
      const result = normalizeSchema(input);
      expect(result).toEqual({
        oneOf: [{}, { 'x-ts-type': 'unknown' }],
      });
    });

    test('preserves discriminator', () => {
      const input: SpecSchema = {
        anyOf: [
          { type: 'object', properties: { kind: { type: 'string', enum: ['a'] } } },
          { type: 'object', properties: { kind: { type: 'string', enum: ['b'] } } },
        ],
        discriminator: { propertyName: 'kind' },
      };
      const result = normalizeSchema(input);
      expect(result.discriminator).toEqual({ propertyName: 'kind' });
    });
  });

  describe('string shorthand', () => {
    test('standard type string shorthand', () => {
      expect(normalizeSchema('string' as SpecSchema)).toEqual({ type: 'string' });
      expect(normalizeSchema('number' as SpecSchema)).toEqual({ type: 'number' });
      expect(normalizeSchema('boolean' as SpecSchema)).toEqual({ type: 'boolean' });
    });

    test('TypeScript type string shorthand', () => {
      expect(normalizeSchema('void' as SpecSchema)).toEqual({ type: 'null', 'x-ts-type': 'void' });
      expect(normalizeSchema('never' as SpecSchema)).toEqual({ not: {} });
      expect(normalizeSchema('any' as SpecSchema)).toEqual({});
      expect(normalizeSchema('unknown' as SpecSchema)).toEqual({ 'x-ts-type': 'unknown' });
      expect(normalizeSchema('bigint' as SpecSchema)).toEqual({
        type: 'integer',
        'x-ts-type': 'bigint',
      });
    });
  });

  describe('options', () => {
    test('includeSchemaField adds $schema', () => {
      const input: SpecSchema = { type: 'string' };
      const result = normalizeSchema(input, { includeSchemaField: true });
      expect(result.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
    });

  });

  describe('deeply nested structures', () => {
    test('handles deeply nested object with all special types', () => {
      const input: SpecSchema = {
        type: 'object',
        properties: {
          level1: {
            type: 'object',
            properties: {
              bigintField: { type: 'bigint' },
              nestedArray: {
                type: 'array',
                items: {
                  anyOf: [{ type: 'void' }, { type: 'never' }, { type: 'symbol' }],
                },
              },
            },
          },
        },
      };
      const result = normalizeSchema(input);
      expect(result).toEqual({
        type: 'object',
        properties: {
          level1: {
            type: 'object',
            properties: {
              bigintField: { type: 'integer', 'x-ts-type': 'bigint' },
              nestedArray: {
                type: 'array',
                items: {
                  anyOf: [
                    { type: 'null', 'x-ts-type': 'void' },
                    { not: {} },
                    { type: 'string', 'x-ts-type': 'symbol' },
                  ],
                },
              },
            },
          },
        },
      });
    });
  });
});

describe('normalizeExport', () => {
  test('normalizes export schema', () => {
    const input: SpecExport = {
      id: 'myFunc',
      name: 'myFunc',
      kind: 'function',
      schema: { type: 'void' },
    };
    const result = normalizeExport(input);
    expect(result.schema).toEqual({ type: 'null', 'x-ts-type': 'void' });
  });

  test('normalizes export signatures', () => {
    const input: SpecExport = {
      id: 'myFunc',
      name: 'myFunc',
      kind: 'function',
      signatures: [
        {
          parameters: [{ name: 'x', schema: { type: 'bigint' }, required: true }],
          returns: { schema: { type: 'void' } },
        },
      ],
    };
    const result = normalizeExport(input);
    expect(result.signatures?.[0].parameters?.[0].schema).toEqual({
      type: 'integer',
      'x-ts-type': 'bigint',
    });
    expect(result.signatures?.[0].returns?.schema).toEqual({ type: 'null', 'x-ts-type': 'void' });
  });

  test('normalizes export members', () => {
    const input: SpecExport = {
      id: 'MyClass',
      name: 'MyClass',
      kind: 'class',
      members: [
        {
          name: 'id',
          kind: 'property',
          schema: { type: 'symbol' },
        },
      ],
    };
    const result = normalizeExport(input);
    expect(result.members?.[0].schema).toEqual({ type: 'string', 'x-ts-type': 'symbol' });
  });
});

describe('normalizeType', () => {
  test('normalizes type schema', () => {
    const input: SpecType = {
      id: 'MyType',
      name: 'MyType',
      kind: 'type',
      schema: { type: 'bigint' },
    };
    const result = normalizeType(input);
    expect(result.schema).toEqual({ type: 'integer', 'x-ts-type': 'bigint' });
  });

  test('normalizes type members', () => {
    const input: SpecType = {
      id: 'MyInterface',
      name: 'MyInterface',
      kind: 'interface',
      members: [
        {
          name: 'callback',
          kind: 'property',
          schema: {
            type: 'function',
            signatures: [{ returns: { schema: { type: 'void' } } }],
          },
        },
      ],
    };
    const result = normalizeType(input);
    // Schema should now be generated from members for interfaces
    expect(result.schema).toEqual({
      type: 'object',
      properties: {
        callback: {
          'x-ts-function': true,
          'x-ts-signatures': [{ returns: { schema: { type: 'null', 'x-ts-type': 'void' } } }],
        },
      },
      required: ['callback'],
    });
  });

  test('generates schema from members for interface', () => {
    const input: SpecType = {
      id: 'User',
      name: 'User',
      kind: 'interface',
      members: [
        { name: 'id', kind: 'property', schema: { type: 'string' } },
        { name: 'age', kind: 'property', schema: { type: 'number' }, flags: { optional: true } },
      ],
    };
    const result = normalizeType(input);
    expect(result.schema).toEqual({
      type: 'object',
      properties: {
        id: { type: 'string' },
        age: { type: 'number' },
      },
      required: ['id'],
    });
  });
});

describe('normalizeMembers', () => {
  describe('property members → properties', () => {
    test('converts property members to properties object', () => {
      const members: SpecMember[] = [
        { name: 'id', kind: 'property', schema: { type: 'string' } },
        { name: 'count', kind: 'property', schema: { type: 'number' } },
      ];
      const result = normalizeMembers(members);
      expect(result).toEqual({
        type: 'object',
        properties: {
          id: { type: 'string' },
          count: { type: 'number' },
        },
        required: ['id', 'count'],
      });
    });

    test('normalizes nested schemas in properties', () => {
      const members: SpecMember[] = [
        { name: 'id', kind: 'property', schema: { type: 'bigint' } },
        { name: 'sym', kind: 'property', schema: { type: 'symbol' } },
      ];
      const result = normalizeMembers(members);
      expect(result.properties).toEqual({
        id: { type: 'integer', 'x-ts-type': 'bigint' },
        sym: { type: 'string', 'x-ts-type': 'symbol' },
      });
    });

    test('preserves property descriptions', () => {
      const members: SpecMember[] = [
        {
          name: 'id',
          kind: 'property',
          schema: { type: 'string' },
          description: 'Unique identifier',
        },
      ];
      const result = normalizeMembers(members);
      expect(result.properties).toEqual({
        id: { type: 'string', description: 'Unique identifier' },
      });
    });
  });

  describe('method and call-signature members → x-ts-function schemas', () => {
    test('converts method members to x-ts-function schemas', () => {
      const members: SpecMember[] = [
        {
          name: 'getName',
          kind: 'method',
          signatures: [
            {
              parameters: [],
              returns: { schema: { type: 'string' } },
            },
          ],
        },
      ];
      const result = normalizeMembers(members);
      expect(result.properties).toEqual({
        getName: {
          'x-ts-function': true,
          'x-ts-signatures': [
            {
              parameters: [],
              returns: { schema: { type: 'string' } },
            },
          ],
        },
      });
    });

    test('normalizes parameter and return schemas in methods', () => {
      const members: SpecMember[] = [
        {
          name: 'process',
          kind: 'method',
          signatures: [
            {
              parameters: [{ name: 'input', schema: { type: 'bigint' }, required: true }],
              returns: { schema: { type: 'void' } },
            },
          ],
        },
      ];
      const result = normalizeMembers(members);
      expect((result.properties as Record<string, unknown>)?.process).toEqual({
        'x-ts-function': true,
        'x-ts-signatures': [
          {
            parameters: [
              { name: 'input', schema: { type: 'integer', 'x-ts-type': 'bigint' }, required: true },
            ],
            returns: { schema: { type: 'null', 'x-ts-type': 'void' } },
          },
        ],
      });
    });

    test('preserves method descriptions', () => {
      const members: SpecMember[] = [
        {
          name: 'greet',
          kind: 'method',
          description: 'Greets the user',
          signatures: [{ returns: { schema: { type: 'string' } } }],
        },
      ];
      const result = normalizeMembers(members);
      expect(
        (result.properties as Record<string, { description?: string }>).greet.description,
      ).toBe('Greets the user');
    });

    test('converts call-signature members to x-ts-function schemas', () => {
      const members: SpecMember[] = [
        {
          name: '()',
          kind: 'call-signature',
          signatures: [
            {
              parameters: [{ name: 'args', schema: { type: 'array' }, required: true }],
              returns: { schema: { type: 'void' } },
            },
          ],
        },
      ];
      const result = normalizeMembers(members);
      expect(result.properties).toEqual({
        '()': {
          'x-ts-function': true,
          'x-ts-signatures': [
            {
              parameters: [{ name: 'args', schema: { type: 'array' }, required: true }],
              returns: { schema: { type: 'null', 'x-ts-type': 'void' } },
            },
          ],
        },
      });
    });
  });

  describe('getter/setter members', () => {
    test('converts getter members with x-ts-accessor extension', () => {
      const members: SpecMember[] = [{ name: 'value', kind: 'getter', schema: { type: 'number' } }];
      const result = normalizeMembers(members);
      expect(result.properties).toEqual({
        value: { type: 'number', 'x-ts-accessor': 'getter' },
      });
    });

    test('converts setter members with x-ts-accessor extension', () => {
      const members: SpecMember[] = [{ name: 'value', kind: 'setter', schema: { type: 'number' } }];
      const result = normalizeMembers(members);
      expect(result.properties).toEqual({
        value: { type: 'number', 'x-ts-accessor': 'setter' },
      });
    });

    test('getter with description', () => {
      const members: SpecMember[] = [
        {
          name: 'count',
          kind: 'getter',
          schema: { type: 'number' },
          description: 'The current count',
        },
      ];
      const result = normalizeMembers(members);
      expect(result.properties).toEqual({
        count: { type: 'number', 'x-ts-accessor': 'getter', description: 'The current count' },
      });
    });
  });

  describe('required array from non-optional members', () => {
    test('includes non-optional members in required', () => {
      const members: SpecMember[] = [
        { name: 'id', kind: 'property', schema: { type: 'string' } },
        { name: 'name', kind: 'property', schema: { type: 'string' } },
      ];
      const result = normalizeMembers(members);
      expect(result.required).toEqual(['id', 'name']);
    });

    test('excludes optional members from required (flags.optional)', () => {
      const members: SpecMember[] = [
        { name: 'id', kind: 'property', schema: { type: 'string' } },
        {
          name: 'nickname',
          kind: 'property',
          schema: { type: 'string' },
          flags: { optional: true },
        },
      ];
      const result = normalizeMembers(members);
      expect(result.required).toEqual(['id']);
    });

    test('excludes optional members from required (name ends with ?)', () => {
      const members: SpecMember[] = [
        { name: 'id', kind: 'property', schema: { type: 'string' } },
        { name: 'nickname?', kind: 'property', schema: { type: 'string' } },
      ];
      const result = normalizeMembers(members);
      expect(result.required).toEqual(['id']);
    });

    test('omits required array when empty', () => {
      const members: SpecMember[] = [
        {
          name: 'optional1',
          kind: 'property',
          schema: { type: 'string' },
          flags: { optional: true },
        },
        {
          name: 'optional2',
          kind: 'property',
          schema: { type: 'number' },
          flags: { optional: true },
        },
      ];
      const result = normalizeMembers(members);
      expect(result.required).toBeUndefined();
    });

    test('methods are included in required', () => {
      const members: SpecMember[] = [
        {
          name: 'getValue',
          kind: 'method',
          signatures: [{ returns: { schema: { type: 'string' } } }],
        },
      ];
      const result = normalizeMembers(members);
      expect(result.required).toEqual(['getValue']);
    });
  });

  describe('index signatures → additionalProperties', () => {
    test('converts index signature to additionalProperties', () => {
      const members: SpecMember[] = [
        { name: 'id', kind: 'property', schema: { type: 'string' } },
        { kind: 'index', schema: { type: 'number' } },
      ];
      const result = normalizeMembers(members);
      expect(result).toEqual({
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
        required: ['id'],
        additionalProperties: { type: 'number' },
      });
    });

    test('normalizes index signature schema', () => {
      const members: SpecMember[] = [{ kind: 'index', schema: { type: 'bigint' } }];
      const result = normalizeMembers(members);
      expect(result.additionalProperties).toEqual({ type: 'integer', 'x-ts-type': 'bigint' });
    });

    test('index signature without name', () => {
      const members: SpecMember[] = [{ kind: 'index', schema: { type: 'string' } }];
      const result = normalizeMembers(members);
      expect(result.properties).toEqual({});
      expect(result.additionalProperties).toEqual({ type: 'string' });
    });

    test('handles index-signature kind from interfaces serializer', () => {
      const members: SpecMember[] = [
        { name: 'id', kind: 'property', schema: { type: 'string' } },
        {
          name: '[string]',
          kind: 'index-signature',
          schema: {
            type: 'object',
            additionalProperties: { type: 'number' },
          },
        },
      ];
      const result = normalizeMembers(members);
      expect(result).toEqual({
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
        required: ['id'],
        additionalProperties: { type: 'number' },
      });
    });

    test('handles index-signature with direct schema (not wrapped)', () => {
      const members: SpecMember[] = [
        {
          kind: 'index-signature',
          schema: { type: 'bigint' },
        },
      ];
      const result = normalizeMembers(members);
      expect(result.additionalProperties).toEqual({ type: 'integer', 'x-ts-type': 'bigint' });
    });
  });

  describe('callable properties (property with signatures)', () => {
    test('converts callable property to x-ts-function schema', () => {
      const members: SpecMember[] = [
        {
          name: 'onClick',
          kind: 'property',
          signatures: [
            {
              parameters: [{ name: 'event', schema: { type: 'object' }, required: true }],
              returns: { schema: { type: 'void' } },
            },
          ],
        },
      ];
      const result = normalizeMembers(members);
      expect(result.properties).toEqual({
        onClick: {
          'x-ts-function': true,
          'x-ts-signatures': [
            {
              parameters: [{ name: 'event', schema: { type: 'object' }, required: true }],
              returns: { schema: { type: 'null', 'x-ts-type': 'void' } },
            },
          ],
        },
      });
    });
  });

  describe('empty and edge cases', () => {
    test('empty members array', () => {
      const result = normalizeMembers([]);
      expect(result).toEqual({
        type: 'object',
        properties: {},
      });
    });

    test('member without name is skipped (except index)', () => {
      const members: SpecMember[] = [
        { kind: 'property', schema: { type: 'string' } }, // no name
        { name: 'valid', kind: 'property', schema: { type: 'number' } },
      ];
      const result = normalizeMembers(members);
      expect(result.properties).toEqual({
        valid: { type: 'number' },
      });
    });
  });

  describe('complex interface example', () => {
    test('converts full interface members to JSON Schema', () => {
      const members: SpecMember[] = [
        {
          name: 'id',
          kind: 'property',
          schema: { type: 'string' },
          description: 'Unique identifier',
        },
        { name: 'age', kind: 'property', schema: { type: 'number' }, flags: { optional: true } },
        {
          name: 'getName',
          kind: 'method',
          description: 'Returns the name',
          signatures: [{ returns: { schema: { type: 'string' } } }],
        },
        { name: 'count', kind: 'getter', schema: { type: 'number' } },
        { kind: 'index', schema: { type: 'any' } },
      ];
      const result = normalizeMembers(members);
      expect(result).toEqual({
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Unique identifier' },
          age: { type: 'number' },
          getName: {
            'x-ts-function': true,
            'x-ts-signatures': [{ returns: { schema: { type: 'string' } } }],
            description: 'Returns the name',
          },
          count: { type: 'number', 'x-ts-accessor': 'getter' },
        },
        required: ['id', 'getName', 'count'],
        additionalProperties: {},
      });
    });
  });
});

describe('normalizeExport with members schema generation', () => {
  test('generates schema from members for interface export', () => {
    const input: SpecExport = {
      id: 'User',
      name: 'User',
      kind: 'interface',
      members: [
        { name: 'id', kind: 'property', schema: { type: 'string' } },
        { name: 'email', kind: 'property', schema: { type: 'string' }, flags: { optional: true } },
      ],
    };
    const result = normalizeExport(input);
    expect(result.schema).toEqual({
      type: 'object',
      properties: {
        id: { type: 'string' },
        email: { type: 'string' },
      },
      required: ['id'],
    });
  });

  test('generates schema from members for class export', () => {
    const input: SpecExport = {
      id: 'Counter',
      name: 'Counter',
      kind: 'class',
      members: [
        { name: 'value', kind: 'property', schema: { type: 'number' } },
        {
          name: 'increment',
          kind: 'method',
          signatures: [{ returns: { schema: { type: 'void' } } }],
        },
      ],
    };
    const result = normalizeExport(input);
    expect(result.schema).toEqual({
      type: 'object',
      properties: {
        value: { type: 'number' },
        increment: {
          'x-ts-function': true,
          'x-ts-signatures': [{ returns: { schema: { type: 'null', 'x-ts-type': 'void' } } }],
        },
      },
      required: ['value', 'increment'],
    });
  });

  test('does not generate schema for function exports', () => {
    const input: SpecExport = {
      id: 'myFunc',
      name: 'myFunc',
      kind: 'function',
      signatures: [{ returns: { schema: { type: 'void' } } }],
    };
    const result = normalizeExport(input);
    expect(result.schema).toBeUndefined();
  });

  test('preserves members array after schema generation', () => {
    const input: SpecExport = {
      id: 'User',
      name: 'User',
      kind: 'interface',
      members: [{ name: 'id', kind: 'property', schema: { type: 'string' } }],
    };
    const result = normalizeExport(input);
    expect(result.members).toBeDefined();
    expect(result.members?.length).toBe(1);
    expect(result.members?.[0].name).toBe('id');
  });
});

describe('extract pipeline integration', () => {
  test('runtime schema merging result is normalized', () => {
    // Simulates a merged runtime schema (from Zod/Valibot) that may have
    // TypeScript-specific types that need normalization
    const exportWithSchema: SpecExport = {
      id: 'userSchema',
      name: 'userSchema',
      kind: 'variable',
      schema: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          createdAt: { type: 'bigint' }, // Runtime schema might use bigint
        },
        required: ['id', 'createdAt'],
      },
    };

    const result = normalizeExport(exportWithSchema);

    // The bigint type should be normalized to integer + x-ts-type
    expect(result.schema).toEqual({
      type: 'object',
      properties: {
        id: { type: 'string' },
        createdAt: { type: 'integer', 'x-ts-type': 'bigint' },
      },
      required: ['id', 'createdAt'],
    });
  });

  test('interface with index-signature kind is properly normalized', () => {
    // This simulates output from the interfaces.ts serializer
    const interfaceExport: SpecExport = {
      id: 'StringMap',
      name: 'StringMap',
      kind: 'interface',
      members: [
        { name: 'count', kind: 'property', schema: { type: 'number' } },
        {
          name: '[string]',
          kind: 'index-signature',
          schema: {
            type: 'object',
            additionalProperties: { type: 'string' },
          },
        },
      ],
    };

    const result = normalizeExport(interfaceExport);

    expect(result.schema).toEqual({
      type: 'object',
      properties: {
        count: { type: 'number' },
      },
      required: ['count'],
      additionalProperties: { type: 'string' },
    });
  });

  test('callable interface with call-signature is normalized', () => {
    // Simulates: interface Fn { (): void }
    const callableInterface: SpecExport = {
      id: 'Callback',
      name: 'Callback',
      kind: 'interface',
      members: [
        {
          name: '()',
          kind: 'call-signature',
          signatures: [
            {
              parameters: [{ name: 'event', schema: { type: 'string' }, required: true }],
              returns: { schema: { type: 'void' } },
            },
          ],
        },
      ],
    };

    const result = normalizeExport(callableInterface);

    expect(result.schema).toEqual({
      type: 'object',
      properties: {
        '()': {
          'x-ts-function': true,
          'x-ts-signatures': [
            {
              parameters: [{ name: 'event', schema: { type: 'string' }, required: true }],
              returns: { schema: { type: 'null', 'x-ts-type': 'void' } },
            },
          ],
        },
      },
      required: ['()'],
    });
  });

  test('class with getters and setters is normalized', () => {
    const classExport: SpecExport = {
      id: 'Counter',
      name: 'Counter',
      kind: 'class',
      members: [
        { name: '_value', kind: 'property', schema: { type: 'number' }, visibility: 'private' },
        { name: 'value', kind: 'getter', schema: { type: 'number' } },
      ],
    };

    const result = normalizeExport(classExport);

    expect(result.schema).toEqual({
      type: 'object',
      properties: {
        _value: { type: 'number' },
        value: { type: 'number', 'x-ts-accessor': 'getter' },
      },
      required: ['_value', 'value'],
    });
  });

  test('nested function signatures are normalized', () => {
    const functionExport: SpecExport = {
      id: 'transform',
      name: 'transform',
      kind: 'function',
      signatures: [
        {
          parameters: [
            {
              name: 'input',
              schema: { type: 'unknown' },
              required: true,
            },
          ],
          returns: {
            schema: {
              anyOf: [{ type: 'string' }, { type: 'void' }, { type: 'never' }],
            },
          },
        },
      ],
    };

    const result = normalizeExport(functionExport);

    expect(result.signatures?.[0].parameters?.[0].schema).toEqual({ 'x-ts-type': 'unknown' });
    expect(result.signatures?.[0].returns?.schema).toEqual({
      anyOf: [
        { type: 'string' },
        { type: 'null', 'x-ts-type': 'void' },
        { not: {} }, // never → not {}
      ],
    });
  });
});

// ============================================================================
// Snapshot Tests for Complex Types
// ============================================================================

describe('snapshot tests for complex types', () => {
  test('deeply nested object with all special types', () => {
    const input: SpecSchema = {
      type: 'object',
      properties: {
        level1: {
          type: 'object',
          properties: {
            bigintField: { type: 'bigint' },
            symbolField: { type: 'symbol' },
            level2: {
              type: 'object',
              properties: {
                callback: {
                  type: 'function',
                  signatures: [
                    {
                      parameters: [{ name: 'x', schema: { type: 'unknown' }, required: true }],
                      returns: { schema: { type: 'void' } },
                    },
                  ],
                },
                items: {
                  type: 'array',
                  items: {
                    anyOf: [
                      { type: 'string' },
                      { type: 'never' },
                      { $ref: '#/types/CustomType', typeArguments: [{ type: 'bigint' }] },
                    ],
                  },
                },
              },
            },
          },
        },
      },
    };

    const result = normalizeSchema(input);
    // Verify the structure is as expected (snapshot will capture full structure)
    expect(result.type).toBe('object');
    expect(result).toMatchSnapshot();
  });

  test('interface with all member kinds', () => {
    const members: SpecMember[] = [
      { name: 'id', kind: 'property', schema: { type: 'string' }, description: 'Unique ID' },
      { name: 'count', kind: 'property', schema: { type: 'bigint' } },
      { name: 'sym', kind: 'property', schema: { type: 'symbol' }, flags: { optional: true } },
      {
        name: 'process',
        kind: 'method',
        description: 'Process data',
        signatures: [
          {
            parameters: [
              { name: 'input', schema: { type: 'unknown' }, required: true },
              { name: 'options', schema: { type: 'object' }, required: false },
            ],
            returns: {
              schema: {
                $ref: '#/types/Promise',
                typeArguments: [{ type: 'void' }],
              },
            },
          },
        ],
      },
      { name: 'value', kind: 'getter', schema: { type: 'number' }, description: 'Current value' },
      { name: 'value', kind: 'setter', schema: { type: 'number' } },
      { kind: 'index', schema: { type: 'any' } },
    ];

    const result = normalizeMembers(members);
    expect(result).toMatchSnapshot();
  });

  test('discriminated union with complex variants', () => {
    const input: SpecSchema = {
      anyOf: [
        {
          type: 'object',
          properties: {
            kind: { type: 'string', enum: ['success'] },
            data: {
              type: 'object',
              properties: {
                id: { type: 'bigint' },
                items: { type: 'array', items: { type: 'symbol' } },
              },
            },
          },
          required: ['kind', 'data'],
        },
        {
          type: 'object',
          properties: {
            kind: { type: 'string', enum: ['error'] },
            error: {
              type: 'object',
              properties: {
                code: { type: 'number' },
                message: { type: 'string' },
                cause: { type: 'unknown' },
              },
            },
          },
          required: ['kind', 'error'],
        },
        {
          type: 'object',
          properties: {
            kind: { type: 'string', enum: ['pending'] },
          },
          required: ['kind'],
        },
      ],
      discriminator: { propertyName: 'kind' },
    };

    const result = normalizeSchema(input);
    expect(result).toMatchSnapshot();
  });

  test('generic type with nested type arguments', () => {
    const input: SpecSchema = {
      $ref: '#/types/ApiResponse',
      typeArguments: [
        {
          $ref: '#/types/Map',
          typeArguments: [
            { type: 'symbol' },
            {
              $ref: '#/types/Array',
              typeArguments: [{ type: 'bigint' }],
            },
          ],
        },
      ],
    };

    const result = normalizeSchema(input);
    expect(result).toMatchSnapshot();
  });

  test('class export with all member types', () => {
    const classExport: SpecExport = {
      id: 'DataProcessor',
      name: 'DataProcessor',
      kind: 'class',
      description: 'Processes data with various operations',
      members: [
        { name: 'id', kind: 'property', schema: { type: 'string' }, visibility: 'public' },
        { name: '_cache', kind: 'property', schema: { type: 'object' }, visibility: 'private' },
        { name: 'status', kind: 'property', schema: { type: 'string' }, visibility: 'protected' },
        { name: 'count', kind: 'getter', schema: { type: 'bigint' } },
        {
          name: 'transform',
          kind: 'method',
          signatures: [
            {
              typeParameters: [{ name: 'T', constraint: 'object' }],
              parameters: [{ name: 'input', schema: { type: 'unknown' }, required: true }],
              returns: {
                schema: {
                  $ref: '#/types/Promise',
                  typeArguments: [{ $ref: '#/types/T' }],
                },
              },
            },
          ],
        },
        {
          name: 'validate',
          kind: 'method',
          signatures: [
            {
              parameters: [{ name: 'data', schema: { type: 'any' }, required: true }],
              returns: { schema: { type: 'boolean' } },
            },
            {
              parameters: [
                { name: 'data', schema: { type: 'any' }, required: true },
                { name: 'strict', schema: { type: 'boolean' }, required: true },
              ],
              returns: { schema: { type: 'void' } },
            },
          ],
        },
      ],
    };

    const result = normalizeExport(classExport);
    expect(result.schema).toMatchSnapshot();
    expect(result.members).toMatchSnapshot();
  });

  test('tuple types with various configurations', () => {
    const tuples: SpecSchema[] = [
      // Simple tuple
      { type: 'tuple', items: [{ type: 'string' }, { type: 'number' }] },
      // Tuple with special types
      { type: 'tuple', items: [{ type: 'bigint' }, { type: 'symbol' }, { type: 'void' }] },
      // Tuple with nested object
      {
        type: 'tuple',
        items: [
          { type: 'string' },
          {
            type: 'object',
            properties: {
              x: { type: 'bigint' },
              y: { type: 'symbol' },
            },
          },
        ],
      },
    ];

    const results = tuples.map((t) => normalizeSchema(t));
    expect(results).toMatchSnapshot();
  });
});

// ============================================================================
// AJV Validation Tests
// ============================================================================

import Ajv from 'ajv';
import addFormats from 'ajv-formats';

describe('AJV validation - normalized output is valid JSON Schema', () => {
  const ajv = new Ajv({ strict: false, allErrors: true });
  addFormats(ajv);

  function validateSchema(schema: ReturnType<typeof normalizeSchema>): boolean {
    try {
      ajv.compile(schema);
      return true;
    } catch {
      return false;
    }
  }

  describe('primitive type schemas are valid', () => {
    // All TypeScript primitive types normalize to valid JSON Schema
    test.each([
      ['void', { type: 'void' }],
      ['never', { type: 'never' }],
      ['any', { type: 'any' }],
      ['unknown', { type: 'unknown' }],
      ['undefined', { type: 'undefined' }],
      ['bigint', { type: 'bigint' }],
      ['symbol', { type: 'symbol' }],
      ['string', { type: 'string' }],
      ['number', { type: 'number' }],
      ['boolean', { type: 'boolean' }],
      ['null', { type: 'null' }],
    ])('%s normalizes to valid JSON Schema', (_name, input) => {
      const result = normalizeSchema(input as SpecSchema);
      expect(validateSchema(result)).toBe(true);
    });

    // void normalizes to { type: 'null', 'x-ts-type': 'void' } - valid JSON Schema
    test('void normalizes to null with x-ts-type extension', () => {
      const result = normalizeSchema({ type: 'void' } as SpecSchema);
      expect(result).toEqual({ type: 'null', 'x-ts-type': 'void' });
      expect(validateSchema(result)).toBe(true);
    });

    // unknown normalizes to { 'x-ts-type': 'unknown' } - valid JSON Schema (empty-ish object)
    test('unknown normalizes with x-ts-type extension', () => {
      const result = normalizeSchema({ type: 'unknown' } as SpecSchema);
      expect(result).toEqual({ 'x-ts-type': 'unknown' });
      expect(validateSchema(result)).toBe(true);
    });
  });

  describe('function schemas are valid', () => {
    test('simple function', () => {
      const input: SpecSchema = {
        type: 'function',
        signatures: [
          {
            parameters: [{ name: 'x', schema: { type: 'number' }, required: true }],
            returns: { schema: { type: 'string' } },
          },
        ],
      };
      const result = normalizeSchema(input);
      expect(validateSchema(result)).toBe(true);
    });

    test('function with special types in signature', () => {
      const input: SpecSchema = {
        type: 'function',
        signatures: [
          {
            parameters: [
              { name: 'input', schema: { type: 'unknown' }, required: true },
              { name: 'callback', schema: { type: 'function' }, required: false },
            ],
            returns: { schema: { type: 'void' } },
          },
        ],
      };
      const result = normalizeSchema(input);
      expect(validateSchema(result)).toBe(true);
    });

    test('overloaded function', () => {
      const input: SpecSchema = {
        type: 'function',
        signatures: [
          {
            parameters: [{ name: 'x', schema: { type: 'string' }, required: true }],
            returns: { schema: { type: 'string' } },
          },
          {
            parameters: [{ name: 'x', schema: { type: 'number' }, required: true }],
            returns: { schema: { type: 'number' } },
          },
        ],
      };
      const result = normalizeSchema(input);
      expect(validateSchema(result)).toBe(true);
    });
  });

  describe('object schemas are valid', () => {
    test('simple object', () => {
      const input: SpecSchema = {
        type: 'object',
        properties: {
          id: { type: 'string' },
          count: { type: 'number' },
        },
        required: ['id'],
      };
      const result = normalizeSchema(input);
      expect(validateSchema(result)).toBe(true);
    });

    test('object with special types', () => {
      const input: SpecSchema = {
        type: 'object',
        properties: {
          id: { type: 'bigint' },
          sym: { type: 'symbol' },
          callback: { type: 'function' },
        },
      };
      const result = normalizeSchema(input);
      expect(validateSchema(result)).toBe(true);
    });

    test('object with additionalProperties', () => {
      const input: SpecSchema = {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
        additionalProperties: { type: 'bigint' },
      };
      const result = normalizeSchema(input);
      expect(validateSchema(result)).toBe(true);
    });

    test('deeply nested object', () => {
      const input: SpecSchema = {
        type: 'object',
        properties: {
          level1: {
            type: 'object',
            properties: {
              level2: {
                type: 'object',
                properties: {
                  level3: {
                    type: 'object',
                    properties: {
                      value: { type: 'bigint' },
                    },
                  },
                },
              },
            },
          },
        },
      };
      const result = normalizeSchema(input);
      expect(validateSchema(result)).toBe(true);
    });
  });

  describe('array and tuple schemas are valid', () => {
    test('simple array', () => {
      const input: SpecSchema = {
        type: 'array',
        items: { type: 'string' },
      };
      const result = normalizeSchema(input);
      expect(validateSchema(result)).toBe(true);
    });

    test('array with special item type', () => {
      const input: SpecSchema = {
        type: 'array',
        items: { type: 'bigint' },
      };
      const result = normalizeSchema(input);
      expect(validateSchema(result)).toBe(true);
    });

    test('tuple', () => {
      const input: SpecSchema = {
        type: 'tuple',
        items: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }],
      };
      const result = normalizeSchema(input);
      expect(validateSchema(result)).toBe(true);
    });

    test('tuple with special types', () => {
      const input: SpecSchema = {
        type: 'tuple',
        items: [{ type: 'bigint' }, { type: 'symbol' }, { type: 'void' }],
      };
      const result = normalizeSchema(input);
      expect(validateSchema(result)).toBe(true);
    });
  });

  describe('combinator schemas are valid', () => {
    test('anyOf', () => {
      const input: SpecSchema = {
        anyOf: [{ type: 'string' }, { type: 'number' }, { type: 'bigint' }],
      };
      const result = normalizeSchema(input);
      expect(validateSchema(result)).toBe(true);
    });

    test('allOf', () => {
      const input: SpecSchema = {
        allOf: [
          { type: 'object', properties: { a: { type: 'string' } } },
          { type: 'object', properties: { b: { type: 'bigint' } } },
        ],
      };
      const result = normalizeSchema(input);
      expect(validateSchema(result)).toBe(true);
    });

    test('oneOf', () => {
      const input: SpecSchema = {
        oneOf: [{ type: 'string' }, { type: 'never' }, { type: 'unknown' }],
      };
      const result = normalizeSchema(input);
      expect(validateSchema(result)).toBe(true);
    });

    test('oneOf with void normalizes to valid JSON Schema', () => {
      const input: SpecSchema = {
        oneOf: [{ type: 'void' }, { type: 'string' }],
      };
      const result = normalizeSchema(input);
      // void normalizes to { type: 'null', 'x-ts-type': 'void' } - valid JSON Schema
      expect(result.oneOf).toContainEqual({ type: 'null', 'x-ts-type': 'void' });
      expect(validateSchema(result)).toBe(true);
    });

    test('discriminated union', () => {
      const input: SpecSchema = {
        anyOf: [
          { type: 'object', properties: { type: { const: 'a' }, value: { type: 'string' } } },
          { type: 'object', properties: { type: { const: 'b' }, count: { type: 'number' } } },
        ],
        discriminator: { propertyName: 'type' },
      };
      const result = normalizeSchema(input);
      expect(validateSchema(result)).toBe(true);
    });
  });

  describe('$ref schemas are structurally valid', () => {
    // Note: AJV can't validate $ref schemas without the referenced definitions,
    // but we can verify the normalized structure is correct JSON Schema format

    test('simple $ref has correct structure', () => {
      const input: SpecSchema = { $ref: '#/types/MyType' };
      const result = normalizeSchema(input);
      expect(result.$ref).toBe('#/types/MyType');
      // $ref by itself is valid JSON Schema structure
      expect(typeof result.$ref).toBe('string');
    });

    test('$ref with typeArguments has correct structure', () => {
      const input: SpecSchema = {
        $ref: '#/types/Promise',
        typeArguments: [{ type: 'string' }],
      };
      const result = normalizeSchema(input);
      expect(result.$ref).toBe('#/types/Promise');
      expect(result['x-ts-type-arguments']).toEqual([{ type: 'string' }]);
    });

    test('$ref with nested special types in typeArguments normalizes correctly', () => {
      const input: SpecSchema = {
        $ref: '#/types/Map',
        typeArguments: [{ type: 'symbol' }, { type: 'bigint' }],
      };
      const result = normalizeSchema(input);
      expect(result.$ref).toBe('#/types/Map');
      expect(result['x-ts-type-arguments']).toEqual([
        { type: 'string', 'x-ts-type': 'symbol' },
        { type: 'integer', 'x-ts-type': 'bigint' },
      ]);
    });
  });

  describe('normalizeMembers produces valid JSON Schema', () => {
    test('interface with all member kinds', () => {
      const members: SpecMember[] = [
        { name: 'id', kind: 'property', schema: { type: 'string' } },
        { name: 'count', kind: 'property', schema: { type: 'bigint' }, flags: { optional: true } },
        {
          name: 'getValue',
          kind: 'method',
          signatures: [{ returns: { schema: { type: 'void' } } }],
        },
        { name: 'value', kind: 'getter', schema: { type: 'symbol' } },
        { kind: 'index', schema: { type: 'any' } },
      ];
      const result = normalizeMembers(members);
      expect(validateSchema(result)).toBe(true);
    });
  });

  describe('normalizeExport produces valid JSON Schema', () => {
    test('interface export', () => {
      const exp: SpecExport = {
        id: 'User',
        name: 'User',
        kind: 'interface',
        members: [
          { name: 'id', kind: 'property', schema: { type: 'string' } },
          { name: 'data', kind: 'property', schema: { type: 'bigint' } },
        ],
      };
      const result = normalizeExport(exp);
      expect(validateSchema(result.schema as Record<string, unknown>)).toBe(true);
    });

    test('class export', () => {
      const exp: SpecExport = {
        id: 'Counter',
        name: 'Counter',
        kind: 'class',
        members: [
          { name: 'value', kind: 'property', schema: { type: 'number' } },
          { name: 'id', kind: 'getter', schema: { type: 'symbol' } },
          {
            name: 'increment',
            kind: 'method',
            signatures: [{ returns: { schema: { type: 'void' } } }],
          },
        ],
      };
      const result = normalizeExport(exp);
      expect(validateSchema(result.schema as Record<string, unknown>)).toBe(true);
    });

    test('function export', () => {
      const exp: SpecExport = {
        id: 'process',
        name: 'process',
        kind: 'function',
        signatures: [
          {
            parameters: [
              { name: 'input', schema: { type: 'unknown' }, required: true },
              { name: 'options', schema: { type: 'object' }, required: false },
            ],
            returns: {
              schema: {
                anyOf: [{ type: 'string' }, { type: 'null' }],
              },
            },
          },
        ],
      };
      const result = normalizeExport(exp);
      // Function exports don't generate schema from members
      expect(result.signatures).toBeDefined();
      // Verify normalized signatures are valid (using null instead of void for JSON Schema validity)
      const sigSchema = result.signatures?.[0].returns?.schema;
      expect(validateSchema(sigSchema as Record<string, unknown>)).toBe(true);
    });

    test('function export with void return normalizes to valid JSON Schema', () => {
      const exp: SpecExport = {
        id: 'doSomething',
        name: 'doSomething',
        kind: 'function',
        signatures: [
          {
            parameters: [],
            returns: { schema: { type: 'void' } },
          },
        ],
      };
      const result = normalizeExport(exp);
      // void normalizes to null with x-ts-type extension
      expect(result.signatures?.[0].returns?.schema).toEqual({ type: 'null', 'x-ts-type': 'void' });
    });
  });

  describe('$schema field option produces correct schema', () => {
    test('with draft-2020-12 $schema', () => {
      const input: SpecSchema = {
        type: 'object',
        properties: { id: { type: 'bigint' } },
      };
      const result = normalizeSchema(input, { includeSchemaField: true });
      expect(result.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
      // Verify the schema structure is correct (AJV strict mode may not recognize 2020-12)
      expect(result.type).toBe('object');
      expect((result.properties as Record<string, unknown>).id).toEqual({
        type: 'integer',
        'x-ts-type': 'bigint',
      });
    });

  });
});

// ============================================================================
// Zod Runtime vs Normalized Static Output Comparison
// ============================================================================

import { z } from 'zod';

describe('Zod runtime vs normalized static output comparison', () => {
  // Helper to get Zod's JSON Schema output
  function getZodJsonSchema(schema: z.ZodType): Record<string, unknown> {
    // Zod v4 uses .toJSONSchema() for Standard JSON Schema
    if ('toJSONSchema' in schema && typeof schema.toJSONSchema === 'function') {
      return schema.toJSONSchema() as Record<string, unknown>;
    }
    // Fallback for schemas without toJSONSchema
    return {};
  }

  describe('primitive types consistency', () => {
    test('string schema matches', () => {
      const zodSchema = z.string();
      const zodJson = getZodJsonSchema(zodSchema);

      const staticSchema: SpecSchema = { type: 'string' };
      const normalized = normalizeSchema(staticSchema);

      // Both should have type: 'string'
      expect(normalized.type).toBe('string');
      if (zodJson.type) {
        expect(zodJson.type).toBe('string');
      }
    });

    test('number schema matches', () => {
      const zodSchema = z.number();
      const zodJson = getZodJsonSchema(zodSchema);

      const staticSchema: SpecSchema = { type: 'number' };
      const normalized = normalizeSchema(staticSchema);

      expect(normalized.type).toBe('number');
      if (zodJson.type) {
        expect(zodJson.type).toBe('number');
      }
    });

    test('boolean schema matches', () => {
      const zodSchema = z.boolean();
      const zodJson = getZodJsonSchema(zodSchema);

      const staticSchema: SpecSchema = { type: 'boolean' };
      const normalized = normalizeSchema(staticSchema);

      expect(normalized.type).toBe('boolean');
      if (zodJson.type) {
        expect(zodJson.type).toBe('boolean');
      }
    });
  });

  describe('object schema consistency', () => {
    test('simple object with required and optional fields', () => {
      const zodSchema = z.object({
        id: z.string(),
        name: z.string(),
        age: z.number().optional(),
      });
      const zodJson = getZodJsonSchema(zodSchema);

      const staticSchema: SpecSchema = {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          age: { type: 'number' },
        },
        required: ['id', 'name'],
      };
      const normalized = normalizeSchema(staticSchema);

      // Both should be objects with similar structure
      expect(normalized.type).toBe('object');
      expect(normalized.properties).toBeDefined();
      expect(normalized.required).toEqual(['id', 'name']);

      if (zodJson.type) {
        expect(zodJson.type).toBe('object');
        expect(zodJson.properties).toBeDefined();
        // Zod's required array should match
        if (Array.isArray(zodJson.required)) {
          expect(zodJson.required).toContain('id');
          expect(zodJson.required).toContain('name');
          expect(zodJson.required).not.toContain('age');
        }
      }
    });

    test('nested object schema', () => {
      const zodSchema = z.object({
        user: z.object({
          profile: z.object({
            bio: z.string().optional(),
          }),
        }),
      });
      const zodJson = getZodJsonSchema(zodSchema);

      const staticSchema: SpecSchema = {
        type: 'object',
        properties: {
          user: {
            type: 'object',
            properties: {
              profile: {
                type: 'object',
                properties: {
                  bio: { type: 'string' },
                },
              },
            },
          },
        },
      };
      const normalized = normalizeSchema(staticSchema);

      // Verify structure matches
      expect(normalized.type).toBe('object');
      expect((normalized.properties as Record<string, unknown>).user).toBeDefined();

      if (zodJson.type === 'object' && zodJson.properties) {
        expect((zodJson.properties as Record<string, unknown>).user).toBeDefined();
      }
    });
  });

  describe('array schema consistency', () => {
    test('simple array', () => {
      const zodSchema = z.array(z.string());
      const zodJson = getZodJsonSchema(zodSchema);

      const staticSchema: SpecSchema = {
        type: 'array',
        items: { type: 'string' },
      };
      const normalized = normalizeSchema(staticSchema);

      expect(normalized.type).toBe('array');
      expect(normalized.items).toEqual({ type: 'string' });

      if (zodJson.type === 'array') {
        expect(zodJson.items).toBeDefined();
      }
    });

    test('array of objects', () => {
      const zodSchema = z.array(
        z.object({
          id: z.string(),
          value: z.number(),
        }),
      );
      const zodJson = getZodJsonSchema(zodSchema);

      const staticSchema: SpecSchema = {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            value: { type: 'number' },
          },
          required: ['id', 'value'],
        },
      };
      const normalized = normalizeSchema(staticSchema);

      expect(normalized.type).toBe('array');
      expect((normalized.items as Record<string, unknown>).type).toBe('object');

      if (zodJson.type === 'array' && zodJson.items) {
        expect((zodJson.items as Record<string, unknown>).type).toBe('object');
      }
    });
  });

  describe('union schema consistency', () => {
    test('string or number union', () => {
      const zodSchema = z.union([z.string(), z.number()]);
      const zodJson = getZodJsonSchema(zodSchema);

      const staticSchema: SpecSchema = {
        anyOf: [{ type: 'string' }, { type: 'number' }],
      };
      const normalized = normalizeSchema(staticSchema);

      // Normalized should have anyOf
      expect(normalized.anyOf).toBeDefined();
      expect(normalized.anyOf).toHaveLength(2);

      // Zod uses anyOf for unions
      if (zodJson.anyOf) {
        expect(zodJson.anyOf).toHaveLength(2);
      }
    });

    test('nullable type', () => {
      const zodSchema = z.string().nullable();
      const zodJson = getZodJsonSchema(zodSchema);

      const staticSchema: SpecSchema = {
        anyOf: [{ type: 'string' }, { type: 'null' }],
      };
      const normalized = normalizeSchema(staticSchema);

      expect(normalized.anyOf).toBeDefined();
      expect(normalized.anyOf).toContainEqual({ type: 'string' });
      expect(normalized.anyOf).toContainEqual({ type: 'null' });

      // Zod nullable can be anyOf or type array
      if (zodJson.anyOf) {
        expect(zodJson.anyOf).toContainEqual({ type: 'null' });
      }
    });
  });

  describe('enum schema consistency', () => {
    test('string enum', () => {
      const zodSchema = z.enum(['admin', 'user', 'guest']);
      const zodJson = getZodJsonSchema(zodSchema);

      const staticSchema: SpecSchema = {
        type: 'string',
        enum: ['admin', 'user', 'guest'],
      };
      const normalized = normalizeSchema(staticSchema);

      expect(normalized.type).toBe('string');
      expect(normalized.enum).toEqual(['admin', 'user', 'guest']);

      // Zod enums also use enum keyword
      if (zodJson.enum) {
        expect(zodJson.enum).toContain('admin');
        expect(zodJson.enum).toContain('user');
        expect(zodJson.enum).toContain('guest');
      }
    });
  });

  describe('tuple schema consistency', () => {
    test('simple tuple', () => {
      const zodSchema = z.tuple([z.string(), z.number()]);
      const zodJson = getZodJsonSchema(zodSchema);

      const staticSchema: SpecSchema = {
        type: 'tuple',
        items: [{ type: 'string' }, { type: 'number' }],
      };
      const normalized = normalizeSchema(staticSchema);

      // Normalized uses prefixItems (JSON Schema 2020-12)
      expect(normalized.type).toBe('array');
      expect(normalized.prefixItems).toBeDefined();
      expect(normalized.prefixItems).toHaveLength(2);

      // Zod v4 emits the same 2020-12 keyword
      if (zodJson.prefixItems) {
        expect(zodJson.prefixItems).toHaveLength(2);
      } else if (zodJson.items && Array.isArray(zodJson.items)) {
        // Fallback for older format
        expect(zodJson.items).toHaveLength(2);
      }
    });
  });

  describe('TypeScript-specific types have no Zod equivalent', () => {
    test('bigint maps to integer with x-ts-type', () => {
      // Note: Zod v4 has z.bigint() but JSON Schema doesn't have bigint
      // Our normalizer maps bigint → { type: 'integer', 'x-ts-type': 'bigint' }

      const staticSchema: SpecSchema = { type: 'bigint' };
      const normalized = normalizeSchema(staticSchema);

      expect(normalized.type).toBe('integer');
      expect(normalized['x-ts-type']).toBe('bigint');
    });

    test('symbol maps to string with x-ts-type', () => {
      // No Zod equivalent for symbol

      const staticSchema: SpecSchema = { type: 'symbol' };
      const normalized = normalizeSchema(staticSchema);

      expect(normalized.type).toBe('string');
      expect(normalized['x-ts-type']).toBe('symbol');
    });

    test('void maps to null with x-ts-type extension', () => {
      // void is semantically different from null in TypeScript
      // void means "no return value" while null is an explicit value
      // We map to null for JSON Schema validity, but preserve 'void' in x-ts-type

      const staticSchema: SpecSchema = { type: 'void' };
      const normalized = normalizeSchema(staticSchema);

      expect(normalized.type).toBe('null');
      expect(normalized['x-ts-type']).toBe('void');
    });

    test('function types use x-ts-function extension', () => {
      // No direct Zod equivalent for function schemas

      const staticSchema: SpecSchema = {
        type: 'function',
        signatures: [
          {
            parameters: [{ name: 'x', schema: { type: 'number' }, required: true }],
            returns: { schema: { type: 'string' } },
          },
        ],
      };
      const normalized = normalizeSchema(staticSchema);

      expect(normalized['x-ts-function']).toBe(true);
      expect(normalized['x-ts-signatures']).toBeDefined();
    });
  });

  describe('real-world schema comparison', () => {
    test('user schema - Zod vs static', () => {
      // Zod schema
      const zodUserSchema = z.object({
        id: z.string(),
        email: z.string(),
        name: z.string(),
        age: z.number().optional(),
        roles: z.array(z.string()),
      });
      const zodJson = getZodJsonSchema(zodUserSchema);

      // Static TypeScript schema (as would be extracted)
      const staticSchema: SpecSchema = {
        type: 'object',
        properties: {
          id: { type: 'string' },
          email: { type: 'string' },
          name: { type: 'string' },
          age: { type: 'number' },
          roles: { type: 'array', items: { type: 'string' } },
        },
        required: ['id', 'email', 'name', 'roles'],
      };
      const normalized = normalizeSchema(staticSchema);

      // Both should produce valid, similar schemas
      expect(normalized.type).toBe('object');
      expect(Object.keys(normalized.properties as object)).toEqual(
        expect.arrayContaining(['id', 'email', 'name', 'age', 'roles']),
      );

      if (zodJson.type === 'object' && zodJson.properties) {
        expect(Object.keys(zodJson.properties as object)).toEqual(
          expect.arrayContaining(['id', 'email', 'name', 'age', 'roles']),
        );
      }

      // Normalized schema should be AJV-valid
      const ajv = new Ajv({ strict: false });
      expect(() => ajv.compile(normalized)).not.toThrow();

      // For Zod schemas, strip the $schema field if present as AJV may not recognize it
      if (zodJson.type) {
        const zodJsonForValidation = { ...zodJson };
        delete zodJsonForValidation.$schema;
        expect(() => ajv.compile(zodJsonForValidation)).not.toThrow();
      }
    });
  });
});
