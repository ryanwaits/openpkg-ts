# @openpkg-ts/cli

CLI for TypeScript API extraction and documentation generation.

## Install

```bash
npm install -g @openpkg-ts/cli
# or use directly
npx @openpkg-ts/cli <command>
```

## Commands

### list

List exports from entry point.

```bash
openpkg list src/index.ts
```

Output: JSON array of `{ name, kind, file, line, description }`

### get

Get detailed spec for single export.

```bash
openpkg get src/index.ts createClient
```

Output: JSON with `{ export, types }` - full spec for the export plus referenced types.

### snapshot

Generate full OpenPkg spec from TypeScript.

```bash
# Write to file
openpkg snapshot src/index.ts -o openpkg.json

# Stdout (pipeable)
openpkg snapshot src/index.ts -o -

# With options
openpkg snapshot src/index.ts --max-depth 4 --runtime --verify
openpkg snapshot src/index.ts --only "use*,create*" --ignore "*Internal"
```

Options:
| Flag | Description |
|------|-------------|
| `-o, --output <file>` | Output file (default: openpkg.json, `-` for stdout) |
| `--max-depth <n>` | Max type depth (default: 4) |
| `--skip-resolve` | Skip external type resolution |
| `--runtime` | Enable Standard Schema runtime extraction (Zod, Valibot) |
| `--only <exports>` | Filter exports (comma-separated, wildcards) |
| `--ignore <exports>` | Ignore exports (comma-separated, wildcards) |
| `--verify` | Exit 1 if any exports fail |

### docs

Generate documentation from spec.

```bash
# Markdown (default)
openpkg docs openpkg.json -o api.md

# HTML
openpkg docs openpkg.json -f html -o api.html

# JSON (simplified structure)
openpkg docs openpkg.json -f json

# Split: one file per export
openpkg docs openpkg.json --split -o docs/api/

# Pipeline: stdin
openpkg snapshot src/index.ts -o - | openpkg docs - -f md
```

Options:
| Flag | Description |
|------|-------------|
| `-o, --output <path>` | Output file or directory (default: stdout) |
| `-f, --format <fmt>` | Format: `md`, `json`, `html` (default: md) |
| `--split` | One file per export (requires `-o` as directory) |

### diff

Compare two specs for breaking changes.

```bash
openpkg diff old.json new.json
openpkg diff old.json new.json --summary
```

Output includes:
- `breaking` - categorized breaking changes
- `added` - new exports
- `removed` - removed exports
- `changed` - modified exports
- `docsOnly` - documentation-only changes
- `summary.semverBump` - recommended version bump

## Pipelines

Commands are composable via stdin/stdout:

```bash
# Extract and generate docs
openpkg snapshot src/index.ts -o - | openpkg docs - -f md > api.md

# Extract, verify, then diff
openpkg snapshot src/index.ts --verify -o new.json
openpkg diff baseline.json new.json --summary
```

## Programmatic Use

```typescript
import { getExport, listExports } from '@openpkg-ts/sdk';

// Same primitives as CLI
const { exports } = await listExports({ entryFile: './src/index.ts' });
const { export: spec } = await getExport({ entryFile: './src/index.ts', exportName: 'myFunc' });
```

## License

MIT
