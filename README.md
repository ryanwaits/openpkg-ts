# openpkg-ts

TypeScript API extraction and documentation toolkit. Extract complete API specifications from source code, then generate docs for any framework.

## Why

- **Zero manual docs** — Extract everything from TypeScript source
- **Framework agnostic** — Fumadocs, Docusaurus, Mintlify, or custom
- **Schema library support** — Zod, Valibot, ArkType, TypeBox
- **Version tracking** — Diff specs and get semver recommendations

## Quick Start

```bash
# Extract spec and generate markdown docs
npx @openpkg-ts/cli snapshot src/index.ts | npx @openpkg-ts/cli docs --format markdown
```

## Packages

| Package | Description |
|---------|-------------|
| [@openpkg-ts/cli](./packages/cli) | CLI tool for extraction and doc generation. `openpkg snapshot`, `openpkg docs`, `openpkg diff` commands. |
| [@openpkg-ts/sdk](./packages/sdk) | Programmatic SDK for extraction, rendering, and querying. Core primitives for building tooling. |
| [@openpkg-ts/spec](./packages/spec) | Core specification types, JSON Schema validation, normalization, and diffing. |
| [@openpkg-ts/react](./packages/react) | React components for rendering API docs. Headless and styled variants. |
| [@openpkg-ts/adapters](./packages/adapters) | Framework adapters (Fumadocs, Docusaurus, Mintlify). |

## How It Works

```
TypeScript Source → [spec] → OpenPkg Spec (JSON) → [docs] → Markdown/HTML/JSON
```

The spec is the intermediate format—validate it, diff it, or feed it to any renderer.

## License

MIT
