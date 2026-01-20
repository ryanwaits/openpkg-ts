# OpenPkg CLI v0.3.0 - Testing Guide

## Setup

```bash
# Install globally
bun add -g @openpkg-ts/cli@0.3.0

# Or use locally
bunx openpkg --help
```

## Step 1: Generate a Spec Snapshot

First, create a spec from any TypeScript package:

```bash
# From a local entry point
openpkg snapshot ./src/index.ts -o v1.json

# Or from installed package
openpkg snapshot ./node_modules/@openpkg-ts/spec/dist/index.d.ts -o spec-v1.json
```

## Step 2: Validate the Spec

```bash
openpkg validate v1.json
```

**Expected output:**
```json
{
  "valid": true,
  "errors": []
}
```

Exit code 0 = valid, 1 = invalid.

## Step 3: Run Diagnostics

Check for doc quality issues:

```bash
openpkg diagnostics v1.json
```

**Expected output:**
```json
{
  "summary": {
    "total": 5,
    "missingDescriptions": 3,
    "deprecatedNoReason": 1,
    "missingParamDocs": 1
  },
  "diagnostics": {
    "missingDescriptions": ["func:myFunc", ...],
    "deprecatedNoReason": ["type:OldType"],
    "missingParamDocs": ["func:parseConfig:options"]
  }
}
```

## Step 4: Filter the Spec

### By kind
```bash
# Only functions
openpkg filter v1.json --kind function

# Only types and interfaces
openpkg filter v1.json --kind type,interface
```

### By name/search
```bash
# Exact name match
openpkg filter v1.json --name "createDocs,loadSpec"

# Search in name/description
openpkg filter v1.json --search "parse"
```

### By metadata
```bash
# Only deprecated
openpkg filter v1.json --deprecated

# Only with descriptions
openpkg filter v1.json --has-description

# Missing descriptions (doc quality check)
openpkg filter v1.json --missing-description
```

### Output options
```bash
# Just counts
openpkg filter v1.json --kind function --summary
# → { "matched": 12, "total": 45 }

# Raw spec (no wrapper)
openpkg filter v1.json --kind function --quiet -o functions.json
```

## Step 5: Make Changes & Create v2

Modify your TypeScript code, then generate a new spec:

```bash
openpkg snapshot ./src/index.ts -o v2.json
```

## Step 6: Diff the Specs

```bash
openpkg diff v1.json v2.json
```

**Expected output:**
```json
{
  "added": ["func:newFunction"],
  "removed": ["func:deletedFunction"],
  "changed": ["type:ModifiedType"],
  "breaking": [
    { "id": "func:deletedFunction", "type": "removed" }
  ]
}
```

## Step 7: Check Breaking Changes

```bash
openpkg breaking v1.json v2.json
```

**Expected output:**
```json
{
  "breaking": [
    {
      "id": "func:parse",
      "change": "removed",
      "category": "function",
      "severity": "major"
    }
  ],
  "count": 1
}
```

Exit code 1 if breaking changes found.

## Step 8: Get Semver Recommendation

```bash
openpkg semver v1.json v2.json
```

**Expected output:**
```json
{
  "bump": "major",
  "reason": "Breaking changes: 1 removed export(s)"
}
```

Or for non-breaking:
```json
{
  "bump": "minor",
  "reason": "New exports added"
}
```

## Step 9: Generate Changelog

### Markdown (default)
```bash
openpkg changelog v1.json v2.json
```

**Expected output:**
```markdown
## Breaking Changes

- **Removed** `deletedFunction` (function)

## Added

- `newFunction`

## Changed

- `someType` (docs)
```

### JSON
```bash
openpkg changelog v1.json v2.json --format json
```

## Step 10: Generate Documentation

### Full spec to markdown
```bash
openpkg docs v1.json -f md -o docs.md
```

### Single export
```bash
openpkg docs v1.json -e createDocs -f md
```

### Split into multiple files
```bash
openpkg docs v1.json --split -o ./docs/
# Creates: ./docs/createDocs.md, ./docs/loadSpec.md, etc.
```

### Different formats
```bash
# JSON (structured)
openpkg docs v1.json -f json -o docs.json

# HTML
openpkg docs v1.json -f html -o docs.html
```

### With adapter (Fumadocs)
```bash
openpkg docs v1.json -a fumadocs -o ./content/api/
```

### From stdin
```bash
cat v1.json | openpkg docs - -f md
```

---

## CI/CD Integration Example

```bash
#!/bin/bash
set -e

# Generate current spec
openpkg snapshot ./src/index.ts -o current.json

# Validate
openpkg validate current.json

# Compare against baseline
if [ -f baseline.json ]; then
  # Check for breaking changes
  if ! openpkg breaking baseline.json current.json; then
    echo "Breaking changes detected!"
    openpkg changelog baseline.json current.json
    exit 1
  fi

  # Get semver recommendation
  openpkg semver baseline.json current.json
fi

# Run diagnostics
openpkg diagnostics current.json
```

---

## Quick Reference

| Command | Purpose | Exit 1 on |
|---------|---------|-----------|
| `validate` | Schema validation | Invalid spec |
| `diagnostics` | Doc quality check | Never (informational) |
| `filter` | Query/filter spec | Error only |
| `diff` | Compare two specs | Never |
| `breaking` | Breaking change detection | Breaking changes found |
| `semver` | Version bump recommendation | Error only |
| `changelog` | Generate changelog | Error only |
| `docs` | Generate documentation | Error only |
