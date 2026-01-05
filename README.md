# openpkg-ts

A comprehensive TypeScript API documentation toolkit that extracts, validates, and generates documentation from your source code.

## The Problem

Keeping API documentation in sync with code is tedious and error-prone. Manual documentation drifts out of date, and existing tools often lock you into a single output format or documentation framework.

## The Solution

openpkg-ts automatically extracts a complete API specification from your TypeScript source code—including types, signatures, JSDoc comments, and examples—then generates documentation in multiple formats for any framework.

## Core Benefits

- **Zero manual documentation** - Extract everything directly from TypeScript source
- **Framework agnostic** - Generate docs for Fumadocs, Docusaurus, or custom sites
- **Multiple output formats** - Markdown, HTML, JSON, and search indices
- **Schema library support** - Works with Zod, Valibot, ArkType, and TypeBox
- **Version tracking** - Diff specs and get semantic versioning recommendations
- **Modular architecture** - Use individual packages or the full toolkit

## Packages

| Package | Description |
|---------|-------------|
| [@openpkg-ts/spec](./packages/spec) | Core spec schema, validation, diffing, and normalization |
| [@openpkg-ts/extract](./packages/extract) | TypeScript export extraction (`tspec` CLI) |
| [@openpkg-ts/doc-generator](./packages/doc-generator) | Multi-format documentation generator |
| [@openpkg-ts/fumadocs-adapter](./packages/fumadocs-adapter) | Fumadocs framework integration |
| [@openpkg-ts/ui](./packages/ui) | Reusable React components for API docs |

## Quick Start

### Extract API Spec

```bash
# Extract spec from TypeScript entry point
npx @openpkg-ts/extract src/index.ts -o openpkg.json

# Or install globally
npm install -g @openpkg-ts/extract
tspec src/index.ts -o openpkg.json
```

### Generate Documentation

```bash
# Generate markdown docs
npx @openpkg-ts/doc-generator openpkg.json -f markdown -o docs/

# Generate JSON for frontend consumption
npx @openpkg-ts/doc-generator openpkg.json -f json -o api.json
```

## What Gets Extracted

openpkg-ts extracts comprehensive metadata from your TypeScript code:

- **Functions** - Signatures, parameters, return types, overloads
- **Classes** - Constructors, methods, properties, inheritance
- **Interfaces & Types** - Full type definitions with generics
- **Enums** - Members with values
- **Variables & Constants** - Types and values
- **JSDoc** - Descriptions, `@param`, `@returns`, `@example`, custom tags
- **Source locations** - File paths and line numbers for linking

## Output Formats

| Format | Use Case |
|--------|----------|
| **Markdown** | Static site generators, GitHub wikis |
| **HTML** | Standalone documentation pages |
| **JSON** | Frontend frameworks, custom rendering |
| **Navigation** | Fumadocs meta, Docusaurus sidebars |
| **Search Index** | Algolia, Pagefind integration |

## Schema Extraction

Beyond standard TypeScript types, openpkg-ts can extract schemas from popular validation libraries:

```typescript
// Zod schemas are automatically converted to JSON Schema
const UserSchema = z.object({
  name: z.string(),
  email: z.string().email(),
  age: z.number().min(0)
});
```

Supported libraries:
- Zod
- Valibot
- ArkType
- TypeBox

## How It Works

```
TypeScript Source
       ↓
   [Extract]  ← AST parsing + type analysis
       ↓
  OpenPkg Spec (JSON)
       ↓
   [Validate] ← JSON Schema validation
       ↓
 [Doc Generator] ← Markdown, HTML, JSON, Search
       ↓
 Documentation Output
```

## Example Spec Output

```json
{
  "name": "my-library",
  "version": "1.0.0",
  "exports": [
    {
      "name": "createUser",
      "kind": "function",
      "signatures": [{
        "parameters": [
          { "name": "name", "type": { "kind": "primitive", "type": "string" } },
          { "name": "email", "type": { "kind": "primitive", "type": "string" } }
        ],
        "returnType": { "kind": "reference", "name": "User" }
      }],
      "description": "Creates a new user account",
      "examples": [{ "code": "const user = createUser('Alice', 'alice@example.com')" }]
    }
  ]
}
```

## CLI Reference

### tspec (Extract)

```bash
tspec <entry> [options]

Options:
  -o, --output <file>     Output file path
  -n, --name <name>       Package name
  -v, --version <ver>     Package version
  --only <patterns>       Only include matching exports
  --ignore <patterns>     Exclude matching exports
  --verbose               Enable verbose output
```

### openpkg-docs (Generate)

```bash
openpkg-docs <spec> [options]

Options:
  -f, --format <format>   Output format (markdown|html|json)
  -o, --output <path>     Output path
  --nav <format>          Navigation format (fumadocs|docusaurus)
  --search <format>       Search index format (algolia|pagefind)
```

## Related

- [DocCov](https://github.com/ryanwaits/doccov) - Documentation coverage analysis using OpenPkg specs

## License

MIT
