import { describe, expect, test } from 'bun:test';
import type { SpecExport, SpecSchema } from '@openpkg-ts/spec';
import type { StandardSchemaExtractionResult } from '../schema/standard-schema';
import { normalizeExport } from '../types/schema-normalizer';
import { mergeRuntimeSchemas } from './schema-merger';

// A recursive vendor schema, the shape Zod v4's toJSONSchema emits — keywords
// the static DSL never produces ($defs, patternProperties, uniqueItems, title)
const RECURSIVE_VENDOR_SCHEMA = {
  $defs: {
    Node: {
      type: 'object',
      title: 'Node',
      properties: {
        value: { type: 'string', pattern: '^v' },
        children: { type: 'array', items: { $ref: '#/$defs/Node' }, uniqueItems: true },
        meta: {
          type: 'object',
          patternProperties: { '^x-': { type: 'string' } },
        },
      },
      required: ['value'],
    },
  },
  $ref: '#/$defs/Node',
} as unknown as SpecSchema;

const staticExport = (overrides: Partial<SpecExport> = {}): SpecExport =>
  ({
    id: 'nodeSchema',
    name: 'nodeSchema',
    kind: 'variable',
    schema: { type: 'object' },
    ...overrides,
  }) as SpecExport;

describe('mergeRuntimeSchemas + normalizeExport (hybrid pipeline)', () => {
  test('vendor schema survives normalization byte-for-byte', () => {
    const runtime = new Map<string, StandardSchemaExtractionResult>([
      [
        'nodeSchema',
        {
          exportName: 'nodeSchema',
          vendor: 'zod',
          outputSchema: RECURSIVE_VENDOR_SCHEMA as Record<string, unknown>,
        } as StandardSchemaExtractionResult,
      ],
    ]);

    const { merged, exports } = mergeRuntimeSchemas([staticExport()], runtime);
    expect(merged).toBe(1);

    const normalized = normalizeExport(exports[0]);
    expect(normalized.schema).toEqual(RECURSIVE_VENDOR_SCHEMA);
  });

  test('non-tagged exports still normalize', () => {
    const exp = staticExport({
      schema: { type: 'tuple', items: [{ type: 'string' }] } as SpecSchema,
    });
    const normalized = normalizeExport(exp);
    expect(normalized.schema).toEqual({
      type: 'array',
      prefixItems: [{ type: 'string' }],
      minItems: 1,
      maxItems: 1,
    } as SpecSchema);
  });

  test('merge tags exports with vendor and schema-source', () => {
    const runtime = new Map<string, StandardSchemaExtractionResult>([
      [
        'nodeSchema',
        {
          exportName: 'nodeSchema',
          vendor: 'zod',
          outputSchema: { type: 'string' },
        } as StandardSchemaExtractionResult,
      ],
    ]);
    const { exports } = mergeRuntimeSchemas([staticExport()], runtime);
    expect(exports[0]?.tags).toEqual(
      expect.arrayContaining([
        { name: 'vendor', text: 'zod' },
        { name: 'schema-source', text: 'standard-json-schema' },
      ]),
    );
  });
});
