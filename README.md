# openpkg-ts

TypeScript API extraction and documentation toolkit. Extract complete API specifications from source code, then generate docs for any framework.

## Why

- **Zero manual docs** — Extract everything from TypeScript source
- **Framework agnostic** — Fumadocs, Docusaurus, Mintlify, or custom
- **Schema library support** — Zod, Valibot, ArkType, TypeBox
- **Version tracking** — Diff specs and get semver recommendations

## Quick Start

```bash
# Extract spec from TypeScript
npx @openpkg-ts/extract src/index.ts -o openpkg.json

# Generate markdown docs
npx @openpkg-ts/doc-generator generate openpkg.json -o docs/api
```

## Packages

| Package | Description |
|---------|-------------|
| [@openpkg-ts/extract](./packages/extract) | TypeScript API extraction via `tspec` CLI. Parses exports, types, JSDoc, and generates JSON Schema 2020-12 output. Supports workspace re-exports, declaration-only mode, and runtime schema extraction. |
| [@openpkg-ts/spec](./packages/spec) | Core specification types, JSON Schema validation, normalization, and diffing. Use for validating specs, comparing versions, and calculating semver bumps. |
| [@openpkg-ts/doc-generator](./packages/doc-generator) | Multi-format documentation generator. Outputs Markdown/MDX, HTML, JSON, navigation configs, and search indexes. Includes React components (headless and styled). |
| [@openpkg-ts/fumadocs-adapter](./packages/fumadocs-adapter) | Fumadocs integration with virtual source generation, styled components, and CSS theming. Single-page and multi-page navigation modes. |
| [@openpkg-ts/ui](./packages/ui) | Reusable React components for API docs. ExportCard, ParameterItem, CodeTabs, and Stripe-style DocsKit components with CodeHike integration. |

## How It Works

```
TypeScript Source → [extract] → OpenPkg Spec (JSON) → [doc-generator] → Docs
```

The spec is the intermediate format—validate it, diff it, or feed it to any renderer.

## License

MIT
