import { describe, expect, test } from 'bun:test';
import { formatSchema } from './query';

describe('formatSchema recursive union explosion', () => {
  test('deeply nested inline union does not explode', () => {
    // Simulates a ClarityValue-like schema where $refs have been resolved inline
    // This is the bug: when UI components resolve $refs before passing to formatSchema,
    // the function sees fully expanded unions and the output grows combinatorially
    const clarityValueSchema = {
      anyOf: [
        { type: 'object', properties: { type: { const: 'int' }, value: { type: 'integer' } } },
        { type: 'object', properties: { type: { const: 'uint' }, value: { type: 'integer' } } },
        { type: 'object', properties: { type: { const: 'bool' }, value: { type: 'boolean' } } },
        { type: 'object', properties: { type: { const: 'buffer' }, value: { type: 'string' } } },
        { type: 'object', properties: { type: { const: 'string-ascii' }, value: { type: 'string' } } },
        { type: 'object', properties: { type: { const: 'string-utf8' }, value: { type: 'string' } } },
        { type: 'object', properties: { type: { const: 'principal' }, value: { type: 'string' } } },
        {
          type: 'object',
          properties: {
            type: { const: 'list' },
            value: {
              type: 'array',
              items: {
                // Recursive: the list items are themselves the full union
                anyOf: [
                  { type: 'object', properties: { type: { const: 'int' }, value: { type: 'integer' } } },
                  { type: 'object', properties: { type: { const: 'uint' }, value: { type: 'integer' } } },
                  { type: 'object', properties: { type: { const: 'bool' }, value: { type: 'boolean' } } },
                  { type: 'object', properties: { type: { const: 'buffer' }, value: { type: 'string' } } },
                  { type: 'object', properties: { type: { const: 'string-ascii' }, value: { type: 'string' } } },
                  { type: 'object', properties: { type: { const: 'string-utf8' }, value: { type: 'string' } } },
                  { type: 'object', properties: { type: { const: 'principal' }, value: { type: 'string' } } },
                  {
                    type: 'object',
                    properties: {
                      type: { const: 'tuple' },
                      value: {
                        type: 'object',
                        properties: {
                          entries: {
                            type: 'array',
                            items: {
                              anyOf: [
                                { type: 'object', properties: { type: { const: 'int' }, value: { type: 'integer' } } },
                                { type: 'object', properties: { type: { const: 'uint' }, value: { type: 'integer' } } },
                                { type: 'object', properties: { type: { const: 'bool' }, value: { type: 'boolean' } } },
                                { type: 'object', properties: { type: { const: 'buffer' }, value: { type: 'string' } } },
                                { type: 'object', properties: { type: { const: 'string-ascii' }, value: { type: 'string' } } },
                                { type: 'object', properties: { type: { const: 'string-utf8' }, value: { type: 'string' } } },
                              ],
                            },
                          },
                        },
                      },
                    },
                  },
                ],
              },
            },
          },
        },
        {
          type: 'object',
          properties: {
            type: { const: 'tuple' },
            value: {
              type: 'object',
              properties: {
                entries: {
                  type: 'array',
                  items: {
                    anyOf: [
                      { type: 'object', properties: { type: { const: 'int' }, value: { type: 'integer' } } },
                      { type: 'object', properties: { type: { const: 'uint' }, value: { type: 'integer' } } },
                      { type: 'object', properties: { type: { const: 'bool' }, value: { type: 'boolean' } } },
                      { type: 'object', properties: { type: { const: 'buffer' }, value: { type: 'string' } } },
                      { type: 'object', properties: { type: { const: 'string-ascii' }, value: { type: 'string' } } },
                      { type: 'object', properties: { type: { const: 'string-utf8' }, value: { type: 'string' } } },
                    ],
                  },
                },
              },
            },
          },
        },
      ],
    };

    const result = formatSchema(clarityValueSchema);
    // With the current bug, this produces 16k+ chars
    // After fix, should stay under 500 chars
    expect(result.length).toBeLessThan(500);
  });

  test('$ref stays compact (no explosion)', () => {
    // When $refs are NOT resolved, formatSchema should just return the type name
    const schema = { $ref: '#/types/ClarityValue' };
    const result = formatSchema(schema);
    expect(result).toBe('ClarityValue');
    expect(result.length).toBeLessThan(50);
  });
});
