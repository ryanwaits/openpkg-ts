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

# With adapter (generates framework-specific output)
openpkg docs openpkg.json --adapter fumadocs -o docs/api/
```

Options:
| Flag | Description |
|------|-------------|
| `-o, --output <path>` | Output file or directory (default: stdout) |
| `-f, --format <fmt>` | Format: `md`, `json`, `html` (default: md) |
| `--split` | One file per export (requires `-o` as directory) |
| `-a, --adapter <name>` | Use adapter: `fumadocs`, `raw` (default: raw) |

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

### breaking

Check for breaking changes. Exit 1 if any found.

```bash
openpkg breaking old.json new.json
```

Output:
```json
{
  "breaking": [
    { "id": "createClient", "name": "createClient", "kind": "function", "severity": "high", "reason": "signature changed" }
  ],
  "count": 1
}
```

### semver

Recommend version bump based on changes.

```bash
openpkg semver old.json new.json
```

Output:
```json
{
  "bump": "major",
  "reason": "1 breaking change detected"
}
```

### validate

Validate spec against schema.

```bash
openpkg validate openpkg.json
openpkg validate openpkg.json --version 1.0
```

Output:
```json
{
  "valid": true,
  "errors": []
}
```

### changelog

Generate changelog from diff.

```bash
openpkg changelog old.json new.json
openpkg changelog old.json new.json --format json
```

Markdown output:
```markdown
## Breaking Changes
- **Removed** `oldFunction` (function)

## Added
- `newFunction`
```

### diagnostics

Analyze spec for quality issues.

```bash
openpkg diagnostics openpkg.json
```

Output:
```json
{
  "summary": {
    "total": 5,
    "missingDescriptions": 3,
    "deprecatedNoReason": 1,
    "missingParamDocs": 1
  },
  "diagnostics": { ... }
}
```

### filter

Filter spec by various criteria.

```bash
openpkg filter openpkg.json --kind function,class
openpkg filter openpkg.json --has-description -o documented.json
openpkg filter openpkg.json --search "user" --summary
openpkg filter openpkg.json --deprecated --quiet | jq '.exports[].name'
```

Options:
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

All criteria use AND logic when combined.

Output (default):
```json
{
  "spec": { ... },
  "matched": 12,
  "total": 45
}
```

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
