# @openpkg-ts/sdk

Programmatic SDK for TypeScript API extraction and documentation generation.

## Install

```bash
npm install @openpkg-ts/sdk
```

## Quick Start

```typescript
import { listExports, getExport, extractSpec, createDocs, toMarkdown } from '@openpkg-ts/sdk';

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
} from '@openpkg-ts/sdk';
```

## License

MIT
