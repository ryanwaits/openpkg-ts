/**
 * Demo: What openpkg.json output looks like with Standard JSON Schema extraction
 *
 * This simulates what the integrated extraction would produce
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractStandardSchemas } from '../../dist/src/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testModulePath = path.join(__dirname, 'test-module.mjs');

// 1. Run Standard JSON Schema runtime extraction
const runtimeResult = await extractStandardSchemas(testModulePath, {
  target: 'draft-2020-12',
});

// 2. Build an openpkg.json-style output
const openpkg = {
  $schema: 'https://unpkg.com/@openpkg-ts/spec/schemas/v0.4.0/openpkg.schema.json',
  openpkg: '0.4.0',
  meta: {
    name: 'zod-example',
    version: '1.0.0',
    description: 'Example package with Zod schemas',
  },
  exports: [],
  types: [],
  generation: {
    generator: '@openpkg-ts/extract',
    timestamp: new Date().toISOString(),
    // This metadata indicates Standard JSON Schema was used
    schemaExtraction: {
      method: 'standard-json-schema',
      runtimeCount: runtimeResult.schemas.size,
      vendors: [...new Set([...runtimeResult.schemas.values()].map((s) => s.vendor))],
    },
  },
};

// 3. Convert each extracted schema to an export
for (const [name, result] of runtimeResult.schemas) {
  openpkg.exports.push({
    id: name,
    name: name,
    kind: 'variable',
    description: `Zod schema for ${name.replace('Schema', '')} validation`,
    // The key difference: schema contains the ACTUAL JSON Schema
    // from ~standard.jsonSchema.output(), not just "ZodObject"
    schema: result.outputSchema,
    // If input differs from output (e.g., transforms), include it
    ...(result.inputSchema &&
    JSON.stringify(result.inputSchema) !== JSON.stringify(result.outputSchema)
      ? { inputSchema: result.inputSchema }
      : {}),
    tags: [
      { name: 'vendor', text: result.vendor },
      { name: 'standard', text: 'json-schema-v1' },
    ],
  });
}

// 4. Output the result
console.log(JSON.stringify(openpkg, null, 2));
