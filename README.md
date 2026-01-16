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
| [@openpkg-ts/cli](./packages/cli) | CLI tool for extraction and doc generation |
| [@openpkg-ts/sdk](./packages/sdk) | Programmatic SDK for extraction, rendering, and querying |
| [@openpkg-ts/spec](./packages/spec) | Spec types, validation, normalization, diffing |
| [@openpkg-ts/react](./packages/react) | React components for API docs (headless + styled) |
| [@openpkg-ts/ui](./packages/ui) | Low-level UI primitives (CodeHike, Radix) |
| [@openpkg-ts/adapters](./packages/adapters) | Framework adapters (Fumadocs) |

### Which package?

- **CLI user** → `@openpkg-ts/cli`
- **Building tooling** → `@openpkg-ts/sdk`
- **React docs site** → `@openpkg-ts/react` (uses ui internally)
- **Fumadocs integration** → `@openpkg-ts/adapters`
- **Custom UI primitives** → `@openpkg-ts/ui`

## How It Works

```
TypeScript Source → [spec] → OpenPkg Spec (JSON) → [docs] → Markdown/HTML/JSON
```

The spec is the intermediate format—validate it, diff it, or feed it to any renderer.

## License

MIT
