# @openpkg-ts/cli

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
