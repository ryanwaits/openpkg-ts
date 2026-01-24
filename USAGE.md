# OpenPkg CLI - Usage Guide

## Setup

```bash
# Install globally
bun add -g @openpkg-ts/cli

# Or use directly
bunx openpkg --help
```

## Command Structure

Commands organized under `openpkg spec` and `openpkg docs`:

```bash
openpkg spec snapshot ./src/index.ts -o spec.json
openpkg spec validate spec.json
openpkg spec diff v1.json v2.json

openpkg docs init
openpkg docs generate spec.json -o ./docs
openpkg docs add function-section
```

Legacy commands still work as aliases (`openpkg snapshot` → `openpkg spec snapshot`).

---

## Spec Commands

### Generate Spec Snapshot

```bash
# From local entry point
openpkg spec snapshot ./src/index.ts -o v1.json

# From installed package
openpkg spec snapshot ./node_modules/@openpkg-ts/spec/dist/index.d.ts -o spec-v1.json
```

### Validate Spec

```bash
openpkg spec validate v1.json
```

Exit code 0 = valid, 1 = invalid.

### Run Diagnostics

```bash
openpkg spec diagnostics v1.json
```

### Filter Spec

```bash
# By kind
openpkg spec filter v1.json --kind function
openpkg spec filter v1.json --kind type,interface

# By name/search
openpkg spec filter v1.json --name "createDocs,loadSpec"
openpkg spec filter v1.json --search "parse"

# By metadata
openpkg spec filter v1.json --deprecated
openpkg spec filter v1.json --has-description
openpkg spec filter v1.json --missing-description

# Output options
openpkg spec filter v1.json --kind function --summary
openpkg spec filter v1.json --kind function --quiet -o functions.json
```

---

## Version Tracking

### Make Changes & Create v2

```bash
openpkg spec snapshot ./src/index.ts -o v2.json
```

### Diff Specs

```bash
openpkg spec diff v1.json v2.json
```

### Check Breaking Changes

```bash
openpkg spec breaking v1.json v2.json
```

Exit code 1 if breaking changes found.

### Get Semver Recommendation

```bash
openpkg spec semver v1.json v2.json
```

### Generate Changelog

```bash
openpkg spec changelog v1.json v2.json
openpkg spec changelog v1.json v2.json --format json
```

---

## Docs Commands

### Initialize Docs Project

```bash
openpkg docs init
```

Creates `openpkg.config.json` with default settings.

### Generate Documentation

```bash
# Markdown (default)
openpkg docs generate spec.json -f md -o docs.md

# React layout (for custom component composition)
openpkg docs generate spec.json -f react -o ./app/api
# Creates layout file + spec JSON, add components via registry

# HTML
openpkg docs generate spec.json -f html -o docs.html

# Split into files
openpkg docs generate spec.json --split -o ./docs/

# With adapter
openpkg docs generate spec.json -a fumadocs -o ./content/api/
```

### Add Components from Registry

```bash
# List available components
openpkg docs list

# Add specific components
openpkg docs add function-section
openpkg docs add class-section interface-section
openpkg docs add export-card param-table
```

16 components available: layouts, sections, primitives.

### View Component Details

```bash
openpkg docs view function-section
```

---

## CI/CD Integration Example

```bash
#!/bin/bash
set -e

# Generate current spec
openpkg spec snapshot ./src/index.ts -o current.json

# Validate
openpkg spec validate current.json

# Compare against baseline
if [ -f baseline.json ]; then
  if ! openpkg spec breaking baseline.json current.json; then
    echo "Breaking changes detected!"
    openpkg spec changelog baseline.json current.json
    exit 1
  fi
  openpkg spec semver baseline.json current.json
fi

# Run diagnostics
openpkg spec diagnostics current.json
```

---

## Quick Reference

| Command | Purpose | Exit 1 on |
|---------|---------|-----------|
| `spec snapshot` | Extract spec from TS | Error only |
| `spec validate` | Schema validation | Invalid spec |
| `spec diagnostics` | Doc quality check | Never |
| `spec filter` | Query/filter spec | Error only |
| `spec diff` | Compare two specs | Never |
| `spec breaking` | Breaking change detection | Breaking changes found |
| `spec semver` | Version bump recommendation | Error only |
| `spec changelog` | Generate changelog | Error only |
| `docs init` | Initialize config | Error only |
| `docs generate` | Generate documentation | Error only |
| `docs add` | Add component from registry | Error only |
| `docs list` | List available components | Error only |
| `docs view` | View component details | Error only |
