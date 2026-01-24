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
npx @openpkg-ts/cli spec snapshot src/index.ts | npx @openpkg-ts/cli docs generate - -f md

# Or use the component registry for React
npx @openpkg-ts/cli docs init
npx @openpkg-ts/cli docs generate spec.json -f react -o ./app/api
npx @openpkg-ts/cli docs add function-section class-section
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
- **Browser/client-side** → `@openpkg-ts/sdk/browser` (no Node.js deps)
- **React docs site** → `@openpkg-ts/react` (uses ui internally)
- **Component registry** → `openpkg docs add <component>` (shadcn-compatible)
- **Fumadocs integration** → `@openpkg-ts/adapters`
- **Custom UI primitives** → `@openpkg-ts/ui`

## How It Works

```
TypeScript Source → [spec] → OpenPkg Spec (JSON) → [docs] → Markdown/HTML/React
```

The spec is the intermediate format—validate it, diff it, or feed it to any renderer.

## Browser SDK

For client-side usage (React, Vite, Next.js client components):

```typescript
import { query, loadSpec } from '@openpkg-ts/sdk/browser';

const functions = query(spec).byKind('function').search('create').find();
```

## Component Registry

16 shadcn-compatible components available:

```bash
openpkg docs list              # See all components
openpkg docs add function-section
openpkg docs add export-card param-table signature
```

## License

MIT
