# @openpkg-ts/cli

CLI for [OpenPkg](https://github.com/ryanwaits/openpkg-ts) — extract TypeScript API specs and generate docs. Thin wrapper over [@openpkg-ts/sdk](https://www.npmjs.com/package/@openpkg-ts/sdk).

## Usage

```bash
# Extract an OpenPkg spec
bunx @openpkg-ts/cli spec src/index.ts -o openpkg.json

# Generate markdown docs (from source or an existing spec)
bunx @openpkg-ts/cli docs src/index.ts -o docs/api.md
bunx @openpkg-ts/cli docs openpkg.json -f html -o docs/api.html

# List exports
bunx @openpkg-ts/cli list src/index.ts

# Diff two specs, get a semver recommendation
bunx @openpkg-ts/cli diff old.json new.json
```

## Commands

| Command | Description |
|---------|-------------|
| `spec <entry.ts>` | Extract an OpenPkg spec from a TypeScript entry point |
| `docs <entry.ts \| spec.json>` | Generate docs (`-f md\|html\|json`) |
| `list <entry.ts>` | List exports with kind and location (`--json`) |
| `diff <old.json> <new.json>` | Compare specs; exits 2 if breaking changes |

`-o, --output` writes to a file instead of stdout.

For programmatic use, richer options, and framework integrations (search indexes, nav trees), use `@openpkg-ts/sdk` directly.

> Versions ≤ 0.6.4 are broken (unresolvable dependency) and deprecated. Use 0.7.0+.

## License

MIT
