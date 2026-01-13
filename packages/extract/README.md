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

# Declaration-only mode (from .d.ts files)
tspec dist/index.d.ts --dts

# Verify all exports are captured
tspec src/index.ts --verify

# Filter exports
tspec src/index.ts --only "use*" --ignore "*Internal"

# With options
tspec src/index.ts --max-depth 4 --verbose
```

## CLI Options

| Flag | Description |
|------|-------------|
| `-o, --output <file>` | Output file path |
| `-n, --name <name>` | Package name (defaults to package.json) |
| `-v, --version <ver>` | Package version |
| `--only <patterns>` | Only include matching exports (supports `*` wildcards) |
| `--ignore <patterns>` | Exclude matching exports (supports `*` wildcards) |
| `--runtime` | Enable runtime schema extraction |
| `--dts` | Declaration-only mode for .d.ts files |
| `--verify` | Verify all discovered exports are extracted |
| `--max-depth <n>` | Max depth for type traversal (default: 4) |
| `--verbose` | Enable verbose output |

## Programmatic Usage

```typescript
import { extract } from '@openpkg-ts/extract';

const result = await extract({
  entryFile: 'src/index.ts',
  maxTypeDepth: 4,
  resolveExternalTypes: true,
  onProgress: (event) => {
    console.log(`${event.phase}: ${event.current}/${event.total}`);
  },
});

console.log(`Extracted ${result.spec.exports.length} exports`);
console.log(`Found ${result.spec.types?.length ?? 0} types`);

// Check for diagnostics
for (const diag of result.diagnostics) {
  console.warn(`${diag.severity}: ${diag.message}`);
}

// Check verification results (if enabled)
if (result.verification) {
  console.log(`Discovered: ${result.verification.discovered}`);
  console.log(`Extracted: ${result.verification.extracted}`);
  console.log(`Missing: ${result.verification.missing.join(', ')}`);
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
| `isDtsSource` | `boolean` | false | Enable declaration-only mode for .d.ts files |
| `verify` | `boolean` | false | Track discovered vs extracted exports |
| `onProgress` | `(event) => void` | - | Progress callback for tracking extraction |

## Features

### Workspace Re-exports

Resolves re-exports across monorepo packages using `pnpm-workspace.yaml` or `package.json` workspaces. When you re-export from a workspace package, the extractor follows project references to get full type information.

```typescript
// packages/core/src/index.ts
export { Button } from '@myorg/ui'; // Resolved via workspace
```

### Declaration-Only Mode

Extract from `.d.ts` files when source isn't available. Useful for analyzing third-party packages or published artifacts.

```bash
tspec node_modules/some-lib/dist/index.d.ts --dts -o some-lib.json
```

Note: JSDoc comments may be stripped in declaration files, resulting in missing descriptions.

### Export Verification

Track whether all discovered exports were successfully extracted:

```bash
tspec src/index.ts --verify
```

Reports any exports that were discovered but failed to extract, helping catch extraction bugs.

### Progress Tracking

Monitor extraction progress for large codebases:

```typescript
const result = await extract({
  entryFile: 'src/index.ts',
  onProgress: ({ phase, current, total, name }) => {
    console.log(`[${phase}] ${current}/${total}: ${name}`);
  },
});
```

Phases: `discovering`, `extracting`, `resolving`, `normalizing`

## JSON Schema 2020-12 Output

All schema output is normalized to valid **JSON Schema 2020-12**. This ensures consistency between static TypeScript analysis and runtime schema extraction from libraries like Zod and Valibot.

### Interface/Class Output Format

```json
{
  "kind": "interface",
  "name": "User",
  "schema": {
    "type": "object",
    "properties": {
      "id": { "type": "string" },
      "age": { "type": "number" }
    },
    "required": ["id"]
  },
  "members": [...]
}
```

### TypeScript Extension Fields (`x-ts-*`)

TypeScript constructs that don't map directly to JSON Schema are preserved using extension fields:

| Extension | Purpose | Example |
|-----------|---------|---------|
| `x-ts-type` | Original TS type | `{ "type": "integer", "x-ts-type": "bigint" }` |
| `x-ts-function` | Function type marker | `{ "x-ts-function": true, "x-ts-signatures": [...] }` |
| `x-ts-signatures` | Function signatures | Array with parameters and returns |
| `x-ts-type-arguments` | Generic args | `{ "$ref": "#/types/Promise", "x-ts-type-arguments": [...] }` |
| `x-ts-accessor` | Getter/setter | `{ "x-ts-accessor": "getter" }` |
| `x-ts-abstract` | Abstract marker | `{ "x-ts-abstract": true }` |
| `x-ts-readonly` | Readonly marker | `{ "x-ts-readonly": true }` |

### Type Flags

Exports include flags for special TypeScript constructs:

```json
{
  "kind": "class",
  "name": "BaseService",
  "flags": {
    "abstract": true,
    "typeOnly": false
  }
}
```

| Flag | Description |
|------|-------------|
| `abstract` | Abstract class or method |
| `typeOnly` | Type-only re-export (`export type { X }`) |
| `deprecated` | Has `@deprecated` JSDoc tag |
| `schemaLibrary` | Variable from Zod/Valibot/etc. |

### Type Mappings

| TypeScript Type | JSON Schema Output |
|-----------------|-------------------|
| `void` | `{ "type": "null", "x-ts-type": "void" }` |
| `never` | `{ "not": {} }` |
| `any` | `{}` |
| `unknown` | `{ "x-ts-type": "unknown" }` |
| `undefined` | `{ "type": "null" }` |
| `bigint` | `{ "type": "integer", "x-ts-type": "bigint" }` |
| `symbol` | `{ "type": "string", "x-ts-type": "symbol" }` |
| `this` | `{ "x-ts-type": "this" }` |
| `[T, U]` (tuple) | `{ "type": "array", "prefixItems": [...], "minItems": 2, "maxItems": 2 }` |
| `() => T` | `{ "x-ts-function": true, "x-ts-signatures": [...] }` |
| `x is T` (predicate) | `{ "x-ts-type-predicate": { "name": "x", "type": {...} } }` |

### Inherited Members

Class members include inheritance info:

```json
{
  "name": "toString",
  "inherited": true,
  "inheritedFrom": "Object"
}
```

### Variance Modifiers

Generic type parameters include variance:

```json
{
  "name": "T",
  "variance": "in" | "out" | "in out"
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
2. Discovers all exported symbols (with optional verification)
3. Resolves workspace re-exports via project references
4. Serializes each export (functions, classes, types, variables)
5. Resolves type references and builds a type registry
6. Normalizes all schemas to JSON Schema 2020-12
7. Outputs an OpenPkg-compliant JSON spec

## License

MIT
