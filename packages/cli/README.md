# @openpkg-ts/cli

Extract [OpenPkg](https://openpkg.dev) documents and generate docs from the command line. The CLI of [openpkg-ts](https://github.com/ryanwaits/openpkg-ts), the TypeScript reference implementation of the OpenPkg standard. Thin wrapper over [@openpkg-ts/sdk](https://www.npmjs.com/package/@openpkg-ts/sdk).

## Usage

```bash
# Extract from an entry file
bunx @openpkg-ts/cli spec src/index.ts -o openpkg.json

# Or resolve the package/entry from a dir, cwd, intent, or git URL
bunx @openpkg-ts/cli spec
bunx @openpkg-ts/cli spec .
bunx @openpkg-ts/cli spec . sdk
bunx @openpkg-ts/cli spec https://github.com/org/repo

# Generate markdown docs (from source or an existing spec)
bunx @openpkg-ts/cli docs src/index.ts -o docs/api.md
bunx @openpkg-ts/cli docs openpkg.json -f html -o docs/api.html

# List exports
bunx @openpkg-ts/cli list src/index.ts

# Diff two specs, get a semver recommendation
bunx @openpkg-ts/cli diff old.json new.json
```

Prefers TypeScript source (`src/index.ts`) over `dist/*.d.ts`. Several packages and no intent → prompt (or a list if not a TTY).

Opt-in Jev routing (needs `AI_GATEWAY_API_KEY` and the `ai` package). Sends package.json + file heads to Vercel AI Gateway with zero data retention:

```bash
bunx @openpkg-ts/cli spec . --jev
bunx @openpkg-ts/cli spec . --jev --follow-external auto
```

`followExternal: "auto"` (config or flag) requires `--jev`. Config: `openpkg.config.json` or `package.json#openpkg`.

```json
{ "followExternal": "auto", "decisions": "jev" }
```

## Commands

| Command | Description |
|---------|-------------|
| `spec [path \| entry.ts] [intent...]` | Extract a spec from a file, package dir, cwd, or git URL |
| `docs [path \| entry.ts \| spec.json] [intent...]` | Generate docs (`-f md\|html\|json`) |
| `list [path \| entry.ts] [intent...]` | List exports with kind and location (`--json`) |
| `diff <old.json> <new.json>` | Compare specs; exits 2 if breaking changes |

`-o, --output` writes to a file instead of stdout. `--jev` routes package/entry with Jev. `--follow-external auto` expands load-bearing externals (requires `--jev`).

For programmatic use, richer options, and framework integrations (search indexes, nav trees), use `@openpkg-ts/sdk` directly.

## Agent-assisted docs generation

The package ships an agent skill that scaffolds framework-ready API reference pages (Fumadocs, Docusaurus, or plain Markdown) — framework detection, page-per-export MDX with navigation, search indexes, and output verification. Copy it into your project's skills directory:

```bash
cp -r node_modules/@openpkg-ts/cli/skills/generate-docs .claude/skills/
```

Then ask your agent to "generate API docs" (or run `/generate-docs` in Claude Code).

> Versions ≤ 0.6.4 are broken (unresolvable dependency) and deprecated. Use 0.7.0+.

## License

MIT
