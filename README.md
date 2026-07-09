# openpkg-ts

TypeScript API extraction and documentation toolkit. Extract complete API specifications from source code, then generate docs for any framework.

## Why

- **Zero manual docs** — Extract everything from TypeScript source
- **Framework agnostic** — Fumadocs, Docusaurus, Mintlify, or custom
- **Schema library support** — Zod, Valibot, ArkType, TypeBox
- **Version tracking** — Diff specs and get semver recommendations

## Quick Start

```bash
# CLI: extract a spec and generate markdown docs
bunx @openpkg-ts/cli spec src/index.ts -o openpkg.json
bunx @openpkg-ts/cli docs src/index.ts -o docs/api.md
```

Or use the SDK programmatically:

```bash
npm install @openpkg-ts/sdk
```

```typescript
import { extractSpec, createDocs } from '@openpkg-ts/sdk';

// Extract full spec from your entry point
const { spec } = await extractSpec({ entryFile: './src/index.ts' });

// Generate docs
const docs = createDocs(spec);
const markdown = docs.toMarkdown();
const html = docs.toHTML();
```

Agent-native primitives for finer-grained workflows:

```typescript
import { listExports, getExport } from '@openpkg-ts/sdk';

// List all exports with metadata
const { exports } = await listExports({ entryFile: './src/index.ts' });

// Get detailed spec for a single export
const { export: fn } = await getExport({ entryFile: './src/index.ts', exportName: 'myFunc' });
```

## Packages

| Package | Description |
|---------|-------------|
| [@openpkg-ts/cli](./packages/cli) | CLI — thin wrapper over the SDK (spec, docs, list, diff) |
| [@openpkg-ts/sdk](./packages/sdk) | Programmatic SDK for extraction, rendering, and querying |
| [@openpkg-ts/spec](./packages/spec) | Spec types, validation, normalization, diffing |

> `@openpkg-ts/adapters` is deprecated — use `@openpkg-ts/sdk` instead. CLI versions ≤ 0.6.4 are broken and deprecated; use 0.7.0+.

### Which package?

- **Terminal / CI usage** → `@openpkg-ts/cli`
- **Building tooling / generating docs** → `@openpkg-ts/sdk`
- **Browser/client-side** → `@openpkg-ts/sdk/browser` (no Node.js deps)
- **Spec types and validation only** → `@openpkg-ts/spec`

## How It Works

```
TypeScript Source → extractSpec → OpenPkg Spec (JSON) → createDocs → Markdown/HTML/JSON
```

The spec is the intermediate format—validate it, diff it, or feed it to any renderer.

## Browser SDK

For client-side usage (React, Vite, Next.js client components):

```typescript
import { query, loadSpec } from '@openpkg-ts/sdk/browser';

const functions = query(spec).byKind('function').search('create').find();
```

## License

MIT
