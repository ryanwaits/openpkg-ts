# @openpkg-ts/extract

TypeScript API extraction library. Generates OpenPkg specs from TypeScript source code with **JSON Schema 2020-12** output.

## Install

```bash
npm install @openpkg-ts/extract
```

## CLI Usage

```bash
# Extract API spec from entry point
tspec src/index.ts -o openpkg.json

# With runtime schema extraction (Zod, Valibot, etc.)
tspec src/index.ts --runtime

# With options
tspec src/index.ts --max-depth 4 --verbose
```

## Programmatic Usage

```typescript
import { extract } from '@openpkg-ts/extract';

const result = await extract({
  entryFile: 'src/index.ts',
  maxTypeDepth: 4,
  resolveExternalTypes: true,
});

console.log(`Extracted ${result.spec.exports.length} exports`);
console.log(`Found ${result.spec.types?.length ?? 0} types`);

// Check for diagnostics
for (const diag of result.diagnostics) {
  console.warn(`${diag.severity}: ${diag.message}`);
}
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `entryFile` | `string` | required | Entry point file path |
| `baseDir` | `string` | cwd | Base directory for resolution |
| `maxTypeDepth` | `number` | 4 | Max depth for type traversal |
| `resolveExternalTypes` | `boolean` | true | Resolve types from node_modules |
| `schemaExtraction` | `'static' \| 'hybrid'` | `'static'` | Schema extraction mode |
| `schemaTarget` | `'draft-2020-12' \| 'draft-07' \| 'openapi-3.0'` | `'draft-2020-12'` | Target JSON Schema dialect |
| `only` | `string[]` | - | Only extract these exports (supports `*` wildcards) |
| `ignore` | `string[]` | - | Ignore these exports (supports `*` wildcards) |

## JSON Schema 2020-12 Output

All schema output is normalized to valid **JSON Schema 2020-12**. This ensures consistency between static TypeScript analysis and runtime schema extraction from libraries like Zod and Valibot.

### Interface/Class Output Format

Interfaces and classes include a `schema` property containing a JSON Schema object representation:

```json
{
  "kind": "interface",
  "name": "User",
  "schema": {
    "type": "object",
    "properties": {
      "id": { "type": "string" },
      "age": { "type": "number" },
      "email": { "type": "string" }
    },
    "required": ["id", "email"]
  },
  "members": [...]
}
```

### TypeScript Extension Fields (`x-ts-*`)

TypeScript constructs that don't map directly to JSON Schema are preserved using extension fields:

| Extension | Purpose | Example |
|-----------|---------|---------|
| `x-ts-type` | Preserves original TypeScript type | `{ "type": "integer", "x-ts-type": "bigint" }` |
| `x-ts-function` | Marks function types | `{ "x-ts-function": true, "x-ts-signatures": [...] }` |
| `x-ts-signatures` | Function/method signatures | Array of signature objects with parameters and returns |
| `x-ts-type-arguments` | Generic type arguments | `{ "$ref": "#/types/Promise", "x-ts-type-arguments": [{ "type": "string" }] }` |
| `x-ts-accessor` | Getter/setter markers | `{ "type": "string", "x-ts-accessor": "getter" }` |

### Type Mappings

| TypeScript Type | JSON Schema Output |
|-----------------|-------------------|
| `void` | `{ "type": "null" }` |
| `never` | `{ "not": {} }` |
| `any` | `{}` |
| `unknown` | `{}` |
| `undefined` | `{ "type": "null" }` |
| `bigint` | `{ "type": "integer", "x-ts-type": "bigint" }` |
| `symbol` | `{ "type": "string", "x-ts-type": "symbol" }` |
| `[T, U]` (tuple) | `{ "type": "array", "prefixedItems": [...], "minItems": 2, "maxItems": 2 }` |
| `() => T` (function) | `{ "x-ts-function": true, "x-ts-signatures": [...] }` |
| `Promise<T>` | `{ "$ref": "#/types/Promise", "x-ts-type-arguments": [<T schema>] }` |

### Example: Function Schema

```json
{
  "kind": "function",
  "name": "fetchUser",
  "signatures": [{
    "parameters": [{
      "name": "id",
      "schema": { "type": "string" },
      "required": true
    }],
    "returns": {
      "schema": {
        "$ref": "#/types/Promise",
        "x-ts-type-arguments": [{ "$ref": "#/types/User" }]
      }
    }
  }]
}
```

### Example: Interface with Methods

```json
{
  "kind": "interface",
  "name": "Repository",
  "schema": {
    "type": "object",
    "properties": {
      "id": { "type": "string" },
      "find": {
        "x-ts-function": true,
        "x-ts-signatures": [{
          "parameters": [{ "name": "query", "schema": { "type": "string" } }],
          "returns": { "schema": { "type": "array", "items": { "$ref": "#/types/Item" } } }
        }]
      }
    },
    "required": ["id", "find"]
  }
}
```

## Exports

### Core
- `extract(options)` - Main extraction function

### AST Utilities
- `getModuleExports` - Get exports from a module
- `resolveExportTarget` - Resolve re-exports to source

### Type Utilities
- `TypeRegistry` - Track and dedupe extracted types
- `serializeType` - Convert TS types to schema

### Schema Normalizer
- `normalizeSchema(schema, options)` - Convert SpecSchema to JSON Schema 2020-12
- `normalizeExport(exp, options)` - Normalize a SpecExport including nested schemas
- `normalizeType(type, options)` - Normalize a SpecType including nested schemas
- `normalizeMembers(members, options)` - Convert members array to JSON Schema properties

### Schema Adapters
- `ZodAdapter`, `ValibotAdapter` - Runtime schema extraction

## How It Works

1. Creates a TypeScript program from the entry file
2. Extracts all exported symbols
3. Serializes each export (functions, classes, types, variables)
4. Resolves type references and builds a type registry
5. **Normalizes all schemas to JSON Schema 2020-12**
6. Outputs an OpenPkg-compliant JSON spec

## License

MIT
