---
"@openpkg-ts/spec": minor
"@openpkg-ts/sdk": minor
"@openpkg-ts/cli": minor
---

Self-contained specs: register every type reachable from the public surface, carry docs into flattened schemas, and fail loudly on empty extraction.

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
