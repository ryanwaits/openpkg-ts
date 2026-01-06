/**
 * Test Standard JSON Schema extraction with Zod 4.2+
 */
import { z } from 'zod';

// Check if Zod exports have ~standard.jsonSchema
const schema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

console.log('Testing Zod Standard JSON Schema support...\n');

// Check ~standard property
const std = schema['~standard'];
if (!std) {
  console.error('ERROR: No ~standard property found');
  process.exit(1);
}

console.log('~standard.version:', std.version);
console.log('~standard.vendor:', std.vendor);
console.log('~standard.jsonSchema:', std.jsonSchema ? 'present' : 'missing');

if (std.jsonSchema) {
  console.log('\nTesting jsonSchema.output()...');
  try {
    const outputSchema = std.jsonSchema.output({ target: 'draft-2020-12' });
    console.log('Output schema:');
    console.log(JSON.stringify(outputSchema, null, 2));
  } catch (e) {
    console.error('ERROR calling jsonSchema.output():', e.message);
  }

  console.log('\nTesting jsonSchema.input()...');
  try {
    const inputSchema = std.jsonSchema.input({ target: 'draft-2020-12' });
    console.log('Input schema:');
    console.log(JSON.stringify(inputSchema, null, 2));
  } catch (e) {
    console.error('ERROR calling jsonSchema.input():', e.message);
  }
} else {
  console.error('\nERROR: jsonSchema methods not found on ~standard');
  console.log('\nAvailable on ~standard:', Object.keys(std));
}
