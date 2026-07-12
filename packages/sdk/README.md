# @openpkg-ts/sdk

Extract [OpenPkg](https://openpkg.dev) documents from TypeScript source and generate documentation. The SDK of [openpkg-ts](https://github.com/ryanwaits/openpkg-ts), the TypeScript reference implementation of the OpenPkg standard.

## Install

```bash
npm install @openpkg-ts/sdk
```

## Entry Points

```typescript
// Full SDK (Node.js)
import { listExports, extractSpec, query } from '@openpkg-ts/sdk';

// Browser-safe (no fs, path, etc.)
import { query, loadSpec } from '@openpkg-ts/sdk/browser';
```

Use `@openpkg-ts/sdk/browser` in React, Vite, Next.js client components.

## Quick Start

```typescript
import { listExports, getExport, extractSpec, createDocs } from '@openpkg-ts/sdk';

// List all exports
const { exports } = await listExports({ entryFile: './src/index.ts' });

// Get single export details
const { export: spec } = await getExport({ entryFile: './src/index.ts', exportName: 'myFunc' });

// Extract full spec
const { spec } = await extractSpec({ entryFile: './src/index.ts' });

// Generate docs
const docs = createDocs(spec);
const markdown = docs.toMarkdown();
```

## Primitives

Agent-native primitives for composable workflows:

### listExports

List exports from entry point with metadata.

```typescript
const { exports, errors } = await listExports({ entryFile: './src/index.ts' });

// Returns: { name, kind, file, line, description }[]
```

### getExport

Get detailed spec for a single export.

```typescript
const { export: spec, types, errors } = await getExport({
  entryFile: './src/index.ts',
  exportName: 'createClient'
});
```

### extractSpec

Generate full OpenPkg spec (all exports + types).

```typescript
const { spec, diagnostics, verification } = await extractSpec({
  entryFile: './src/index.ts',
  maxTypeDepth: 4,
  resolveExternalTypes: true,
  only: ['use*'],           // filter by pattern
  ignore: ['*Internal'],    // exclude by pattern
});
```

### diffSpecs

Compare two specs for breaking changes.

```typescript
import { diffSpecs } from '@openpkg-ts/sdk';

const diff = diffSpecs(oldSpec, newSpec);
console.log(`Breaking: ${diff.breaking.length}`);

// With options
const diff = diffSpecs(oldSpec, newSpec, {
  includeDocsOnly: false,  // exclude docs-only changes
  kinds: ['function', 'class'],  // filter by kind
});
```

### filterSpec

Immutable spec filtering by criteria.

```typescript
import { filterSpec } from '@openpkg-ts/sdk';

// Filter by kind
const { spec, matched, total } = filterSpec(fullSpec, {
  kinds: ['function', 'class'],
});

// Filter by tags
filterSpec(spec, { tags: ['public'] });

// Filter deprecated exports
filterSpec(spec, { deprecated: true });

// Search by name/description
filterSpec(spec, { search: 'client' });

// Combine criteria (AND logic)
filterSpec(spec, {
  kinds: ['function'],
  hasDescription: true,
  deprecated: false,
});
```

### analyzeSpec

Analyze spec for quality issues.

```typescript
import { analyzeSpec } from '@openpkg-ts/sdk';

const diagnostics = analyzeSpec(spec);

console.log(`Missing descriptions: ${diagnostics.missingDescriptions.length}`);
console.log(`Deprecated without reason: ${diagnostics.deprecatedNoReason.length}`);
console.log(`Missing param docs: ${diagnostics.missingParamDocs.length}`);
```

## Documentation Generation

### createDocs / loadSpec

```typescript
import { createDocs, loadSpec } from '@openpkg-ts/sdk';

// From file path
const docs = createDocs('./openpkg.json');

// From spec object
const docs = loadSpec(spec);
```

### Render Functions

```typescript
// Full API reference
const markdown = docs.toMarkdown({ frontmatter: true, codeSignatures: true });
const html = docs.toHTML({ fullDocument: true, includeStyles: true });
const json = docs.toJSON();

// Single export
const markdown = docs.toMarkdown({ exportId: 'createClient' });
```

### Navigation

```typescript
import { toFumadocsMetaJSON, toDocusaurusSidebarJS } from '@openpkg-ts/sdk';

const fumadocsMeta = toFumadocsMetaJSON(spec, { basePath: '/api' });
const docusaurusSidebar = toDocusaurusSidebarJS(spec);
```

### Search Index

```typescript
import { toSearchIndex, toAlgoliaRecords } from '@openpkg-ts/sdk';

const searchIndex = toSearchIndex(spec);
const algoliaRecords = toAlgoliaRecords(spec, { indexName: 'api_docs' });
```

## QueryBuilder API

Fluent API for querying specs. Available in both Node.js and browser entry points.

```typescript
import { query } from '@openpkg-ts/sdk';
// or: import { query } from '@openpkg-ts/sdk/browser';

// Chain filters
const functions = query(spec)
  .byKind('function')
  .search('create')
  .find();

// Multiple kinds
const classesAndInterfaces = query(spec)
  .byKind('class', 'interface')
  .find();

// Combine filters
const documented = query(spec)
  .byKind('function')
  .hasDescription()
  .notDeprecated()
  .find();

// Get single export
const createClient = query(spec).byName('createClient').first();

// Search by tags
const publicAPIs = query(spec).byTag('public').find();
```

### QueryBuilder Methods

| Method | Description |
|--------|-------------|
| `.byKind(...kinds)` | Filter by export kind |
| `.byName(...names)` | Filter by exact name |
| `.byId(...ids)` | Filter by export ID |
| `.byTag(...tags)` | Filter by tags |
| `.search(term)` | Search name/description |
| `.hasDescription()` | Only with descriptions |
| `.missingDescription()` | Only without descriptions |
| `.deprecated()` | Only deprecated |
| `.notDeprecated()` | Exclude deprecated |
| `.find()` | Return all matches |
| `.first()` | Return first match |
| `.count()` | Return match count |

## Query Utilities

```typescript
import {
  buildSignatureString,
  formatParameters,
  formatReturnType,
  getProperties,
  getMethods,
  resolveTypeRef,
} from '@openpkg-ts/sdk';
```

## Types

```typescript
import type {
  OpenPkg,
  SpecExport,
  ExtractOptions,
  ExtractResult,
  DocsInstance,
  SimplifiedSpec,
  FilterCriteria,
  FilterResult,
  SpecDiagnostics,
  DiffOptions,
  QueryBuilder,
} from '@openpkg-ts/sdk';
```

## Browser Entry Point

`@openpkg-ts/sdk/browser` exports only browser-safe utilities:

- `query()` - QueryBuilder
- `loadSpec()` - Load spec from object
- `filterSpec()` - Filter spec by criteria
- `buildSignatureString()` - Format signatures
- Query utilities (formatParameters, getProperties, etc.)

No Node.js dependencies (fs, path, child_process).

## License

MIT
