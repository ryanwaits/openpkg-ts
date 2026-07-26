# @openpkg-ts/cli

## 0.11.3

### Patch Changes

- Updated dependencies [62401ad]
  - @openpkg-ts/sdk@0.51.0

## 0.11.2

### Patch Changes

- Updated dependencies [c5efa6f]
  - @openpkg-ts/sdk@0.50.0

## 0.11.1

### Patch Changes

- Updated dependencies [a61527c]
- Updated dependencies [d7a8662]
  - @openpkg-ts/sdk@0.49.0

## 0.11.0

### Minor Changes

- Make external-type following usable from the CLI, and stop the declaring-package
  guessing game.

  - External stubs now record their **declaring package** as `x-ts-package`, so a
    spec is self-documenting about what can be expanded (e.g. a type imported from
    `ai` but declared in `@ai-sdk/provider-utils` says so).
  - `followExternal` accepts **glob patterns** — `["@ai-sdk/*"]` expands every
    `@ai-sdk/*` package, since one logical dependency often spreads types across
    sibling packages.
  - The CLI `spec` command gains `--follow-external <pkg,...>` (globs ok),
    `--follow-external-all`, `--only`, and `--ignore`, and reads
    `openpkg.config.json` (or a `package.json "openpkg"` field). Flags override
    the file. `OpenpkgConfig` now carries `followExternal`/`only`/`ignore`.
  - By default the CLI prints which external packages were stubbed and how to
    expand them, so you never have to guess the right name to add.

### Patch Changes

- Updated dependencies
  - @openpkg-ts/sdk@0.48.0

## 0.10.0

### Minor Changes

- Add `openpkg validate <spec.json>` to check a spec against the OpenPkg
  meta-schema, harden `openpkg diff` to reject structurally invalid inputs
  instead of crashing, and add `openpkg diff --json` for machine-readable
  CI output (breaking/non-breaking/docs-only changes, categorized breaking
  changes, semver recommendation, and next version).

### Patch Changes

- Updated dependencies
  - @openpkg-ts/sdk@0.47.0

## 0.9.3

### Patch Changes

- Updated dependencies [73bc6d9]
- Updated dependencies [73bc6d9]
  - @openpkg-ts/sdk@0.46.0

## 0.9.2

### Patch Changes

- Updated dependencies [60f9238]
- Updated dependencies [60f9238]
- Updated dependencies [60f9238]
  - @openpkg-ts/sdk@0.45.0

## 0.9.1

### Patch Changes

- Updated dependencies [93e5e73]
- Updated dependencies [4f50432]
  - @openpkg-ts/sdk@0.44.0

## 0.9.0

### Minor Changes

- 87922cd: Self-contained specs: register every type reachable from the public surface, carry docs into flattened schemas, and fail loudly on empty extraction.

  - **Reachable-type expansion** (sdk): types referenced by the public surface but
    never re-exported (utility-type flatten targets, heritage bases, checker-erased
    aliases, namespace-qualified refs) now register in `types[]`. Workspace sibling
    packages follow by default; `followExternal: boolean | string[]` widens or
    disables. Name collisions get deterministic package-scoped ids, never `_2`.
  - **Docs in flattened schemas** (sdk/spec): `schema.properties.*` carry
    `description`, `deprecated`, and `x-deprecated-reason`; spec schema documents
    them.
  - **Intersection-alias members** (sdk): `Omit<Base,'k'> & {…}` aliases emit
    resolved `members[]` alongside the `allOf` schema; member kind now follows
    declaration syntax (function-typed properties stay properties).
  - **anyOf dedupe** (sdk): structurally-identical union branches collapse
    (`string | null | undefined` → one null branch).
  - **Enum member names** (sdk): registry enum entries always carry
    `x-enum-members`; `x-*` extensions survive normalization.
  - **Function aliases** (sdk): registry entries for `type Fn = (x) => y` emit
    signatures instead of an opaque stub.
  - **Hard failure on empty extraction** (sdk/cli): an entry with no module symbol
    or zero exports is an error diagnostic; the CLI exits 1 and writes no output
    (`spec`, `docs`, `list`). `createProgram` also drops tsconfig sources whose
    declaration-emit target collides with a `.d.ts` entry (silent-empty root
    cause).

### Patch Changes

- Updated dependencies [87922cd]
  - @openpkg-ts/sdk@0.43.0

## 0.8.4

### Patch Changes

- Updated dependencies
  - @openpkg-ts/sdk@0.42.0

## 0.8.3

### Patch Changes

- Updated dependencies [30b370c]
  - @openpkg-ts/sdk@0.41.0

## 0.8.2

### Patch Changes

- Updated dependencies [f9e2049]
  - @openpkg-ts/sdk@0.40.0

## 0.8.1

### Patch Changes

- Updated dependencies
  - @openpkg-ts/sdk@0.39.0

## 0.8.0

### Minor Changes

- 623d86b: Ship the generate-docs agent skill in the npm tarball (skills/generate-docs/SKILL.md). Copy it into your project's .claude/skills/ to let an agent scaffold framework-ready API reference docs (Fumadocs, Docusaurus, plain Markdown) with navigation, search indexes, and output verification.

### Patch Changes

- Updated dependencies [623d86b]
- Updated dependencies [3dc6c72]
  - @openpkg-ts/sdk@0.38.0

## 0.7.0

### Minor Changes

- 6a468e0: Rebuild CLI as a thin wrapper over @openpkg-ts/sdk. Commands: spec (extract OpenPkg spec), docs (markdown/HTML/JSON), list (exports), diff (semver recommendation, exit 2 on breaking). Replaces the broken 0.6.x line, which depended on the never-published @openpkg-ts/registry and could not be installed.
