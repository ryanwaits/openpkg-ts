/**
 * Test our extractStandardSchemas function
 */
import { extractStandardSchemas } from '../../dist/src/index.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testModulePath = path.join(__dirname, 'test-module.mjs');

console.log('Testing extractStandardSchemas...');
console.log('Module path:', testModulePath);
console.log();

const result = await extractStandardSchemas(testModulePath, {
  target: 'draft-2020-12',
});

if (result.errors.length > 0) {
  console.error('Errors:', result.errors);
}

console.log(`Found ${result.schemas.size} Standard JSON Schemas:\n`);

for (const [name, schema] of result.schemas) {
  console.log(`=== ${name} ===`);
  console.log('Vendor:', schema.vendor);
  console.log('Output Schema:', JSON.stringify(schema.outputSchema, null, 2).substring(0, 200) + '...');
  if (schema.inputSchema && JSON.stringify(schema.inputSchema) !== JSON.stringify(schema.outputSchema)) {
    console.log('Input Schema DIFFERS from output');
  }
  console.log();
}

// Also check what schemas exist in the module directly
console.log('\n=== Checking module exports directly ===');
const mod = await import(testModulePath);
for (const [name, value] of Object.entries(mod)) {
  if (typeof value === 'object' && value !== null && value['~standard']) {
    const std = value['~standard'];
    console.log(`${name}: vendor=${std.vendor}, hasJsonSchema=${!!std.jsonSchema}`);
  }
}
