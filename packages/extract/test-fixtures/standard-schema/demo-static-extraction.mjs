/**
 * Demo: What static TypeScript extraction produces for the same schemas
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { extract } from '../../dist/src/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Run static extraction on the TypeScript source
const result = await extract({
  entryFile: path.join(__dirname, 'index.ts'),
  resolveExternalTypes: false, // Don't resolve Zod internals
  maxTypeDepth: 2,
});

// Filter to just the schema exports
const schemaExports = result.spec.exports.filter((e) => e.name.endsWith('Schema'));

console.log('=== STATIC EXTRACTION OUTPUT ===\n');

for (const exp of schemaExports) {
  console.log(`${exp.name}:`);
  console.log(JSON.stringify(exp.schema, null, 2));
  console.log();
}
