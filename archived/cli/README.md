# @openpkg-ts/cli

CLI for TypeScript API extraction and documentation generation.

## Install

```bash
npm install -g @openpkg-ts/cli
# or use directly
npx @openpkg-ts/cli <command>
```

## Command Structure

Commands organized under `openpkg spec` and `openpkg docs`. Legacy commands work as aliases.

```bash
openpkg spec snapshot ./src/index.ts -o spec.json
openpkg spec validate spec.json

openpkg docs init
openpkg docs generate spec.json -o ./docs
openpkg docs add function-section
```

---

## Spec Commands

### list

```bash
openpkg list src/index.ts
```

Output: JSON array of `{ name, kind, file, line, description }`

### get

```bash
openpkg get src/index.ts createClient
```

Output: JSON with `{ export, types }` - full spec for the export plus referenced types.

### spec snapshot

```bash
openpkg spec snapshot src/index.ts -o openpkg.json
openpkg spec snapshot src/index.ts -o -  # stdout
openpkg spec snapshot src/index.ts --max-depth 4 --runtime --verify
openpkg spec snapshot src/index.ts --only "use*,create*" --ignore "*Internal"
```

| Flag | Description |
|------|-------------|
| `-o, --output <file>` | Output file (default: openpkg.json, `-` for stdout) |
| `--max-depth <n>` | Max type depth (default: 4) |
| `--skip-resolve` | Skip external type resolution |
| `--runtime` | Enable Standard Schema runtime extraction (Zod, Valibot) |
| `--only <exports>` | Filter exports (comma-separated, wildcards) |
| `--ignore <exports>` | Ignore exports (comma-separated, wildcards) |
| `--verify` | Exit 1 if any exports fail |

### spec validate

```bash
openpkg spec validate openpkg.json
openpkg spec validate openpkg.json --version 1.0
```

### spec diagnostics

```bash
openpkg spec diagnostics openpkg.json
```

### spec filter

```bash
openpkg spec filter openpkg.json --kind function,class
openpkg spec filter openpkg.json --has-description -o documented.json
openpkg spec filter openpkg.json --search "user" --summary
openpkg spec filter openpkg.json --deprecated --quiet | jq '.exports[].name'
```

| Flag | Description |
|------|-------------|
| `--kind <kinds>` | Filter by kinds (comma-separated) |
| `--name <names>` | Filter by exact names (comma-separated) |
| `--id <ids>` | Filter by export IDs (comma-separated) |
| `--tag <tags>` | Filter by tags (comma-separated) |
| `--deprecated` | Only deprecated exports |
| `--no-deprecated` | Exclude deprecated exports |
| `--has-description` | Only exports with descriptions |
| `--missing-description` | Only exports without descriptions |
| `--search <term>` | Search name/description (case-insensitive) |
| `--module <path>` | Filter by source file path (contains) |
| `-o, --output <file>` | Output file (default: stdout) |
| `--summary` | Only output matched/total counts |
| `--quiet` | Output raw spec only (no wrapper) |

### spec diff

```bash
openpkg spec diff old.json new.json
openpkg spec diff old.json new.json --summary
```

### spec breaking

Exit 1 if breaking changes found.

```bash
openpkg spec breaking old.json new.json
```

### spec semver

```bash
openpkg spec semver old.json new.json
```

### spec changelog

```bash
openpkg spec changelog old.json new.json
openpkg spec changelog old.json new.json --format json
```

---

## Docs Commands

### docs init

Initialize docs configuration.

```bash
openpkg docs init
```

Creates `openpkg.config.json` with default settings.

### docs generate

Generate documentation from spec.

```bash
# Markdown (default)
openpkg docs generate openpkg.json -o api.md

# React layout (single layout + spec JSON, add components via registry)
openpkg docs generate openpkg.json -f react -o ./app/api

# HTML
openpkg docs generate openpkg.json -f html -o api.html

# JSON (simplified structure)
openpkg docs generate openpkg.json -f json

# Split: one file per export
openpkg docs generate openpkg.json --split -o docs/api/

# With adapter
openpkg docs generate openpkg.json -a fumadocs -o docs/api/

# From stdin
openpkg spec snapshot src/index.ts -o - | openpkg docs generate - -f md
```

| Flag | Description |
|------|-------------|
| `-o, --output <path>` | Output file or directory (default: stdout) |
| `-f, --format <fmt>` | Format: `md`, `json`, `html`, `react` (default: md) |
| `--split` | One file per export (requires `-o` as directory) |
| `-a, --adapter <name>` | Use adapter: `fumadocs`, `raw` (default: raw) |

### docs add

Add components from shadcn-compatible registry.

```bash
openpkg docs add function-section
openpkg docs add class-section interface-section
openpkg docs add export-card param-table signature
```

### docs list

List available registry components.

```bash
openpkg docs list
```

16 components available: layouts, sections, primitives.

### docs view

View component details and dependencies.

```bash
openpkg docs view function-section
```

---

## Pipelines

Commands are composable via stdin/stdout:

```bash
# Extract and generate docs
openpkg spec snapshot src/index.ts -o - | openpkg docs generate - -f md > api.md

# Extract, verify, then diff
openpkg spec snapshot src/index.ts --verify -o new.json
openpkg spec diff baseline.json new.json --summary
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
