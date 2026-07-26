# @openpkg-ts/extract

## 0.51.0

### Minor Changes

- 62401ad: Stop losing text in the two places that reconstructed it instead of reading it.

  **This one changes existing field values.** Rounds 5 and 6 could promise the
  spec was byte-identical with the new field stripped; this cannot. `description`
  on a parameter can widen from one line to several, which is visible to anything
  rendering it in a table cell. That is the whole point of the fix, but it is a
  behavior change rather than an addition.

  **`@param` kept only its first paragraph.** TSDoc block tags run until the next
  block tag, so everything up to `@returns` documents the parameter. The extractor
  split on the first blank line and discarded the rest — silently, from every
  field, including the reconstructed `tag.text`, which made `@param` the one tag
  whose text had no home in the spec:

  ```ts
  /**
   * @param mode - The mode.
   *
   *   Pass "fast" to skip validation. See {@link Other} for details.
   */
  ```

  The second paragraph is now retained, and its `{@link Other}` shows up in the
  parameter tag's `inlineTags` with no extra machinery — round 5's scanner reads
  the text that was previously deleted before it got there.

  The blank-line split itself was right about one thing, and that part is kept: a
  _trailing paragraph made only of inline tags_ is a whole-comment annotation, not
  parameter documentation. Round 6 already computed exactly that split, so the two
  rounds now share one rule — a trailing tag-only paragraph is the comment's,
  everything else is the tag's. Comment-level tags are unchanged by this release.

  **`@see` leaked raw JSDoc line markers.** Every continuation line of a
  multi-line `@see` arrived with a literal `*` in it, where the same prose under
  `@remarks` came out clean:

  ```
  @remarks A guide,   ->  "A guide,\nwhich covers retries."
  @see     A guide,   ->  "A guide,\n * which covers retries."   (before)
  ```

  One marker per line is now stripped, anchored to horizontal whitespace so blank
  lines survive and a markdown bullet or `*emphasis*` at line start is not eaten.

  `@see` still reads source text rather than TypeScript's flattened comment, and
  that is deliberate — TypeScript treats whatever follows `@see` as a link target
  and drops it. On 5.9.3, `@see https://example.com/docs` flattens to
  `://example.com/docs`, and `@see The guide` flattens to `guide`. Both are now
  covered by regression tests, so the reconstruction is not "simplified away"
  later.

## 0.50.1

### Patch Changes

- af8d911: Fix inline tags written outside any block tag being dropped.

  Round 5 covered inline tags in the summary, inside a block tag's text, in
  examples, and on properties. It missed the position where a whole-comment
  annotation naturally goes — on its own line between block tags, or trailing
  after the last one:

  ```ts
  /**
   * Initializes the client.
   *
   * @param options - Connection options.
   *
   * {@label Initialization}
   *
   * @returns The initialized client.
   */
  ```

  Those were not merely unstructured, they were gone: no `inlineTags`, and no raw
  `{@label` left in the output to recover them from. The same tag two lines
  higher, in the summary, worked — a silent, position-dependent failure.

  TSDoc has no syntax for "this belongs to the comment", so TypeScript attaches
  that line to whichever block tag precedes it. The extractor then dropped it:
  `stripParamSeparator` splits on the blank line and keeps only the first
  paragraph, on the (correct) grounds that loose text after a blank line is not
  part of the param. The judgment was already right; the content was discarded
  instead of hoisted.

  A trailing paragraph consisting solely of inline tags is now treated as an
  annotation on the doc comment and surfaces in the export's or member's
  `inlineTags`, after any tags from the summary.

  Scoped against over-capture, which is the real risk here:

  - **Trailing paragraphs only, never the sole one.** `@remarks {@link Other}` is
    that tag's content and stays on the tag.
  - **Tag-only paragraphs only.** A paragraph with prose in it belongs to the
    block tag it follows and is left alone.
  - **The block tag no longer claims what was hoisted.** A hoisted tag appears at
    comment level, not on the `@param` it happened to sit under — the spec should
    not assert a relationship the source does not have.
  - **`@see` is untouched**, since it runs its own URL-preserving extraction.

  Text fields are unchanged, so round 5's additive guarantee still holds: on the
  fixture the spec is byte-identical with `inlineTags` removed, and a tag in the
  summary line produces exactly the output it did in 0.50.0.

  Known boundary, unchanged by this fix: a trailing paragraph that mixes prose
  with an inline tag (`See {@link Other} for the rest.`) is still dropped from the
  param description by the same separator strip. Hoisting it would over-capture —
  it reads as the param's text — so recovering it is a question about that strip,
  not about inline tags.

## 0.50.0

### Minor Changes

- c5efa6f: Add `inlineTags`: the inline TSDoc tags (`{@link}`, `{@label}`) found in a doc
  comment, exposed as structured data alongside the text they came from.

  Block tags were already structured — `@remarks` and `@example` arrive as
  `tags: [{name, text}]`. Inline tags were not: they stayed embedded in whatever
  prose contained them, so a consumer needed its own TSDoc parser to get at them.
  `{@label Transport}` is metadata that happens to be written inline, and
  recovering it meant regexing it out of a description; `{@link sendBatch}` is
  genuinely part of the sentence, and rendering it as a cross-reference meant the
  same regex again.

  Every node that carries documentation now carries the inline tags found in its
  own text: export, type, member, signature, parameter, block tag, and example.

  ```jsonc
  "description": "Prefer {@link sendBatch} for more than one item. {@label Transport}",
  "inlineTags": [
    { "name": "link",  "text": "sendBatch" },
    { "name": "label", "text": "Transport" }
  ]
  ```

  Scoped to keep it additive and predictable:

  - **Text is untouched.** The tags stay in the description, tag text, and example
    code exactly as before — stripping them would break anything already consuming
    those fields, and `{@link}` legitimately belongs in the sentence. Verified on
    the fixture: the spec is byte-identical with `inlineTags` removed.
  - **Own text only.** A node's `inlineTags` come from its own text field, never
    aggregated from its children. An export's list is what its description
    contained; the `@remarks` tag keeps its own; the example keeps its own.
  - **Omitted, not emptied.** Nodes whose docs contain no inline tags gain no
    field, so existing exact-equality assertions on tags and members still hold.
  - **Any inline tag, not a whitelist.** TypeScript only parses the three `{@link}`
    forms; `{@label}` and friends never leave the comment text at all. The scan
    covers TSDoc's inline-tag grammar generally, so custom tags come through too.
    A backslash escapes the brace.

  The meta-schema declares `inlineTags` on `export`, `typeDef`, `member`,
  `signature`, `parameter`, `tag`, and `example` — the last two matter, since both
  are `additionalProperties: false` and would otherwise have failed validation.
  `normalize()` preserves it on tags and `diffSpec` treats it as documentation, so
  an inline-tag-only change stays a non-breaking diff.

  Also fixes a latent data loss on the namespace/re-export path, which flattened
  doc comments by mapping over `.text`: a JSDocLink node's `.text` holds only what
  follows the entity name, so `{@link Foo}` collapsed to an empty string and the
  symbol name was dropped outright. It now uses TypeScript's own serializer.

  **Left for a separate decision:** a side list is enough to _extract_ metadata and
  makes link rendering possible (a consumer can substitute by name), but it is not
  enough to _render_ prose with links substituted in place — that needs character
  offsets or a structured rich-text representation of the doc comment, which is a
  much larger commitment than a string plus a side list. A narrower middle option
  also exists and is not implemented here: `{@link}` targets are resolvable by the
  checker at parse time, so an inline tag could carry the export it resolves to
  rather than just the name a consumer has to match itself.

### Patch Changes

- Updated dependencies [c5efa6f]
  - @openpkg-ts/spec@0.50.0

## 0.49.0

### Minor Changes

- a61527c: Add `x-ts-declared`: the type as the author wrote it, alongside the resolved
  `x-ts-type`.

  `x-ts-type` carries the resolved truth, which a validator or codegen wants but a
  docs reader often does not recognize: `type WithoutKind<T> = Omit<T, 'kind'>`
  resolves to `{ [P in Exclude<keyof T, "kind">]: T[P]; }`, and a property typed
  `InitiatorType` resolves to its full literal union. `x-ts-declared` now carries
  `Omit<T, 'kind'>` and `InitiatorType` respectively, so a docs consumer can show
  the declared form without re-parsing source.

  Scoped to keep it signal, not noise:

  - **Divergence only.** Emitted solely when the declared form differs from the
    resolved `x-ts-type`, so the common case (declared == resolved) is unchanged.
  - **Named forms only.** Restricted to type references and unions — the shapes
    where the author wrote a name that resolves to something else. Object literals,
    mapped, and conditional bodies are excluded, since they differ from their
    resolved text only by formatting (a trailing `;`) or would drag source
    comments into the spec.
  - **Never affects member extraction.** Object properties stay resolved; this is
    purely an additional rendered-text field.

  The meta-schema declares `x-ts-declared`. Known minor case left for a follow-up:
  `ReadonlyArray<T>` vs the resolved `readonly T[]` still diverges as a notation
  equivalent; both are faithful, so it is emitted rather than normalized away.

- d7a8662: Three fidelity fixes found by replacing a doc pipeline's type extraction
  end-to-end (membership and content, no fallback extractor).

  - **Enum members keep `@deprecated`.** The enum serializer only read a member's
    description; it now also carries the member's tags and deprecation, so a
    deprecated enum value and its migration note survive (previously
    `Mode.Legacy` lost its `deprecated` flag, reason, and description).
  - **Callable object types keep their members.** A callable type literal
    (`{ (input: string): boolean; label: string }`) emitted the signature but
    dropped its properties; `label` (with its description) now appears in
    `members[]` alongside the `x-ts-signatures`.
  - **Index-signature aliases carry renderable text.** An index-signature-only
    alias (`type PropertyFilters = { [key: string]: string[] }`) had no named
    members and no `x-ts-type`, leaving a consumer to hand-build the notation from
    `additionalProperties`. The registry entry now carries
    `x-ts-type: "{ [key: string]: string[]; }"`.

### Patch Changes

- Updated dependencies [a61527c]
  - @openpkg-ts/spec@0.49.0

## 0.48.1

### Patch Changes

- Fix same-named types shadowing each other in the type registry. When two
  different types shared a name (e.g. a `Logger` interface in two packages of one
  build), the registry keyed them by bare name, so one silently dropped the other:
  the published type kept one interface's members and references pointing at the
  shadowed type resolved to the wrong one.

  The registry now keys types by a collision-safe id derived from the DECLARATION.
  Unique names keep their bare id (specs without collisions are byte-identical to
  before), import aliases and re-exports of one type collapse to a single id, and
  two genuinely different same-named types get distinct package-scoped ids
  (`Logger`, `otherpkg.Logger`) with their own members and correctly disambiguated
  `$ref`s. `resolveRef` now resolves by id first, name second.

- Updated dependencies
  - @openpkg-ts/spec@0.48.1

## 0.48.0

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

## 0.47.2

### Patch Changes

- Fix generic indexed-access types that resolve to a primitive (e.g.
  `Extract<Union, {...}>["name"]`, whose base constraint is `string`) leaking ~50
  `String.prototype`/`Number.prototype` methods into their `types[]` schema.
  Registered types now emit `{ "type": "string", "x-ts-type": "…" }` instead of a
  bogus object of `charAt`/`toFixed`/etc. Surfaced by extracting a real ABI helper
  library built on conditional/indexed-access type machinery.

## 0.47.1

### Patch Changes

- Fix optional properties on `type` aliases (e.g. `type Opts = { x?: T }`) emitting
  a spurious `null` branch. The interface/class serializers already stripped the
  `undefined` branch for optional members; the type-alias path
  (`serializeResolvedMembers`) now does too, so `{ "x": null }` is no longer
  accepted where TypeScript would reject it. Surfaced by extracting a real library
  whose option types are type aliases rather than interfaces.

## 0.47.0

### Minor Changes

- Standard Schema JSON Schema compatibility + wire-format fixes.

  Wire format (spec):

  - Emit the JSON Schema 2020-12 tuple keyword `prefixItems` instead of the
    misspelled `prefixedItems`. The normalizer still accepts the legacy spelling
    on input, so specs generated by 0.4.x tooling keep normalizing cleanly.
  - Removed the `dialect` / `schemaTarget` options — output is now always JSON
    Schema 2020-12. Dialect targeting is an adapter concern (see `asStandardSchema`).
  - Tightened the v0.4.0 meta-schema: `type` is enum-restricted to the seven JSON
    Schema primitives (plus the 2020-12 array form), the full `x-ts-*` extension
    vocabulary is declared, and the DSL-only string/`signatures` schema branches
    were dropped.

  Fidelity (sdk):

  - References to lib built-ins (`Date`, `Map`, `Promise`, ...) and generic type
    parameters no longer emit dangling `#/types/X` refs — built-ins get structural
    schemas, type parameters get `x-ts-type` text. `dereference()` now preserves
    ref siblings (e.g. `x-ts-type-arguments`).
  - Vendor-provided Standard Schema output (hybrid extraction) is preserved
    byte-for-byte instead of being degraded by re-normalization.
  - Optional properties/parameters no longer gain a spurious `null` branch; number
    index signatures become `patternProperties`; template-literal types lower to a
    `string` + `pattern`; generic conditional aliases no longer explode into
    prototype methods; regular parameter defaults are captured.
  - External/ambient types outside the entry package now register as opaque stubs
    by default (no more environment-dependent 600-line expansions). Pass
    `followExternal: true` to restore full expansion.

  New JSON Schema adapters (sdk): `toJsonSchema` (bundles `#/types/` refs into a
  standalone `$defs` document), `toToolSchema` (OpenAI-strict / Anthropic tool
  input schemas), and `asStandardSchema` (a `StandardJSONSchemaV1` producer with
  draft-2020-12 / draft-07 / openapi-3.0 targets).

### Patch Changes

- Updated dependencies
  - @openpkg-ts/spec@0.47.0

## 0.46.0

### Minor Changes

- 73bc6d9: Preserve `typeParameters` on registry entries.

  - **sdk**: registry entries for generic aliases, interfaces, and classes now
    carry `typeParameters` (names, constraints, defaults, variance) the same way
    exports do — consumers can tell a generic alias (which cannot be flattened
    without its arguments) from a concrete one.
  - **spec**: `SpecType.typeParameters?: SpecTypeParameter[]` added (additive).

- 73bc6d9: Emit `x-ts-type` on signature-carrying members.

  Members with `signatures[]` (interface/class methods, resolved alias method
  members, inherited methods) previously had no renderable type text at any
  level. They now carry a synthetic function schema —
  `{ "x-ts-function": true, "x-ts-type": "(pace: number) => void" }` — chosen
  over a member-level field so the text lives where all other type text lives
  (the schema layer) and flows through the normalizer unchanged. Same renderer,
  policy, and `import()` scrub as property schemas; `x-ts-method` still marks
  method-syntax declarations independently. Flattened interface/class schema
  properties generated from members mirror the text.

### Patch Changes

- Updated dependencies [73bc6d9]
  - @openpkg-ts/spec@0.46.0

## 0.45.0

### Minor Changes

- 60f9238: Extract `members[]` for object-literal, mapped, and cross-package aliases.

  Previously only intersection and mapped-node aliases got the JSDoc-rich
  members layer; `type Options = {…}` and `type Chosen = Pick<Base, 'a'>`
  silently dropped per-property descriptions, tags, and flags. Array/tuple
  aliases and TS-lib builtins (`Promise`, `Date`) are excluded so prototype
  methods never leak in as members. The intersection path is unchanged.

- 60f9238: Record method-syntax declaration form on members.

  - **sdk**: members declared with method syntax (`run(cmd: string): void`) now
    carry `flags.methodSyntax: true`; function-typed properties
    (`walk: () => void`) do not. For resolved alias members the flag comes from
    `SymbolFlags.Method` on the post-mapping symbol — Omit/Pick-mapped members
    lose it, method-syntax re-declarations keep it — preserving the checker
    distinction doc pipelines filter on. Mirrored as `x-ts-method: true` on
    schema-layer function-valued properties. Resolved alias members also gain
    `flags.optional` and `flags.readonly` for parity with interface members.
  - **spec**: new optional `x-ts-method` JSON Schema extension documented on
    `JSONSchemaExtensions` (additive).

- 60f9238: Emit `x-ts-type` (checker-rendered type text) on member, property, and alias schemas.

  - Every property schema — both `members[].schema` and registry
    `schema.properties` — now carries the developer-facing type text rendered at
    the owning declaration with `NoTruncation` (`"Handler | Handler[]"`,
    `"boolean | Config"`, `"(c: Config) => void"`, `"\"auto\" | \"manual\""`).
    Omitted only when trivially derivable: bare primitive keywords and `$ref`s
    whose target name equals the text. Optional properties render without
    `| undefined`.
  - Alias-level `x-ts-type` for array, instantiation, union, intersection, and
    function aliases (`"Item[]"`, `"Holder<string, Item>"`).
  - `import("<abs path>").` qualifiers are scrubbed from all rendered text —
    machine-specific paths never land in a published spec.
  - `readonly` members now surface at the schema layer as JSON Schema
    `readOnly: true` (previously member-layer `flags.readonly` only).
  - Array aliases (`type L = Item[]`) get a real `{type: "array", items}`
    registry schema instead of an empty object.
  - The normalizer preserves `x-*` extensions and `readOnly` across all branches
    (combinators, objects, arrays, refs).

### Patch Changes

- Updated dependencies [60f9238]
  - @openpkg-ts/spec@0.45.0

## 0.44.0

### Minor Changes

- 4f50432: Surface inherited constructor signatures on subclasses that declare none of their own.

  - **sdk**: when a class has no own constructor, construct signatures are resolved
    through the type checker — so base-class constructors (same file or sibling
    workspace package) appear on the subclass export with full JSDoc (description,
    param docs, tags, examples). Overloaded base constructors all serialize with
    `overloadIndex`. Default synthesized constructors (no declaration anywhere in
    the chain) still emit no signatures.
  - **spec**: new optional `SpecSignature.inheritedFrom` field marks which base
    class declared the signature. Added to the v0.4.0 JSON schema along with the
    previously undocumented signature `tags`/`examples` fields (additive).

### Patch Changes

- 93e5e73: Constructor signatures keep JSDoc `tags` and `examples` (`@param`, `@remarks`, `@example`) instead of dropping everything but the description — matching method signature serialization.
- Updated dependencies [4f50432]
  - @openpkg-ts/spec@0.44.0

## 0.43.0

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
  - @openpkg-ts/spec@0.43.0

## 0.42.0

### Minor Changes

- Fix silent property truncation on wide types (dogfood round 2):

  - `types[]` registry entries sliced properties to `maxProperties` BEFORE filtering, so skipped names consumed limit budget and real members past the raw cutoff were silently dropped. Intersection types (`Omit<A, K> & B`) were hit hardest: the checker appends the object-literal branch's members last, so they always fell past the cutoff on wide bases (a 132-key config flattened to 97). Filters now run before the slice.
  - Underscore-prefixed members (`_onCapture`, `__preview_*`, `__extensionClasses`) were dropped from all schema paths while export serializers kept them — the same name resolved to different shapes in `exports[]` vs `types[]`. They are real API surface and now survive everywhere; only checker-internal symbol-keyed names (`__@iterator@…`) are filtered.
  - Default `maxProperties` raised 100 → 500. Real-world config interfaces exceed 100 keys; the `onTruncation` warning still fires at the limit, now based on the post-filter count.

## 0.41.0

### Patch Changes

- 30b370c: Formatting fix in type-alias serializer (biome, no behavior change).
- Updated dependencies [5a78ddb]
  - @openpkg-ts/spec@0.41.0

## 0.40.0

### Minor Changes

- f9e2049: Extraction fidelity for wasm/proxy-style surfaces. Mapped/conditional type aliases (`{[K in keyof SDK]: ...}`) now flatten into `members[]` via the checker, with `@deprecated`/JSDoc recovered from conditional arm aliases (syntax walk — the checker erases alias identity on instantiation). Inline function-type aliases get real signatures instead of an opaque self-`$ref`. Default compilerOptions now include `strict: true` so `T | undefined` unions survive extraction when no tsconfig is present.

## 0.39.0

### Minor Changes

- Monorepo/workspace extraction fixes + utility-type flattening:

  - Workspace-package types no longer collapse to `<external>` stubs: entry paths are absolutized before resolution (relative entries previously broke the workspace-root walk and node_modules lookup), and workspace entry resolution falls back through `src/index.ts` → `src/index.tsx` → `index.ts` → package.json `types`/`typings`.
  - Instantiated utility types (`Omit`, `Pick`, `Partial`, `Required`, `Readonly`, `Record`, `Exclude`, `Extract`, `NonNullable`, `Awaited`) flatten to their effective members instead of emitting dangling `$ref: #/types/Omit`. Deferred instantiations in generic context keep the `$ref` + type-arguments form.
  - Index signatures now emit `additionalProperties` (`Record<string, V>` and inline `{ [key: string]: V }`).
  - Emitted `source.file` paths are cwd-relative for machine-independent specs.

## 0.38.0

### Minor Changes

- 623d86b: Remove toReact/toReactString and the ReactLayoutOptions type. The generated scaffolds pointed at the retired component registry workflow ("openpkg docs add") and never-shipped components. For framework docs generation use toMarkdown/toHTML with toNavigation/toFumadocsMetaJSON/toDocusaurusSidebarJS, or the generate-docs agent skill shipped with @openpkg-ts/cli.

### Patch Changes

- 3dc6c72: Type-level fixes, no runtime changes: ExportMetadata now correctly types tags/examples as SpecTag[]/SpecExample[]; getExportKind return type narrowed to the kinds it can actually produce; getUnionType internal-API call wrapped in a scoped typed cast; removed stale JSDoc pointing at the retired component registry. Zero tsc errors across the monorepo.

## 0.37.1

### Patch Changes

- 1471007: Fix naive kind pluralization producing labels like "Classs" in markdown/HTML headings, HTML nav, and Algolia record hierarchy. All kind labels now come from KIND_LABELS in @openpkg-ts/spec (class → Classes, etc.). Also fixes nav group sorting, which de-pluralized titles naively and broke kind ordering for classes.

## 0.37.0

### Minor Changes

- f0edc6d: Fix P1 bugs (boolean literal, $constructor, never type, member/re-export @deprecated), raise maxProperties to 100, clarify render function JSDoc, improve get command with referenced type resolution

### Patch Changes

- Updated dependencies [f0edc6d]
  - @openpkg-ts/spec@0.37.0

## 0.36.0

### Minor Changes

- Separate visitedTypes/registeredTypes, resolve external transitive types, kill packages/ui

  **SDK:**

  - Split `visitedTypes` (stack-scoped recursion guard) from `registeredTypes` (permanent registration set) to prevent cross-contamination between schema building and type registration
  - Add `findTypeInProgram()` to resolve $ref targets from transitive dependencies (monorepo siblings, .d.ts files) not visible from entry file scope
  - Emit $ref for named type aliases before union/intersection decomposition — prevents inlining of types like `SignedMultiSigTokenTransferOptions`
  - Post-process pass now searches all program source files, not just entry scope

  **Registry:**

  - Kill `packages/ui`, consolidate all docskit source into `packages/registry`
  - `ExpandableParameter` now resolves anyOf/allOf $ref members and merges object properties into expandable param list
  - Restructure shadcn registry components to import from docskit barrel

  **Adapters:**

  - Update imports for registry consolidation

## 0.35.1

### Patch Changes

- Add single-column theme for API reference

  **@openpkg-ts/ui:**

  - Add `SectionAccordion` component - collapsible section with header toggle
  - Add `APISectionSingle` component - single-column 780px centered layout
  - Add `theme` prop to `APIReferencePage` (`'default' | 'single'`)
  - Export new components from docskit barrel

  **@openpkg-ts/sdk, @openpkg-ts/cli, @openpkg-ts/adapters, @openpkg-ts/spec:**

  - Lint fixes (biome)

- Updated dependencies
  - @openpkg-ts/spec@0.35.1

## 0.35.0

### Minor Changes

- Add configurable maxProperties limit with onTruncation callback for object type serialization

## 0.34.1

### Patch Changes

- Codebase health improvements: bounded caches, path traversal fix, module extraction, stricter linting
- Updated dependencies
  - @openpkg-ts/spec@0.34.1

## 0.34.0

### Minor Changes

- CLI: docs subcommands (generate/init/add/list), spec subcommand, component registry
  SDK: browser export, query builder API
  React: new headless/styled components, adapters

## 0.33.1

### Patch Changes

- Fix local re-export resolution when extended tsconfig can't be resolved. Now includes all tsconfig.fileNames in program root files so tsx re-exports resolve correctly.

## 0.33.0

### Minor Changes

- feat(sdk,cli): external package re-export resolution and config file support

  - Add `--external-include/exclude/depth` flags for resolving re-exports from external packages
  - Add config file support via `openpkg.config.json` or package.json "openpkg" field
  - Add `--verbose` flag showing detailed skipped/external export info
  - Add `SkippedExportDetail` type with skip reasons and package info

### Patch Changes

- Updated dependencies
  - @openpkg-ts/spec@0.33.0

## 0.32.1

### Patch Changes

- Fix optional parameter detection and arrow function serialization

  - Optional params (`?` or default values) now correctly marked `required: false`
  - Arrow function consts now serialize as `kind: 'function'` instead of `kind: 'variable'`

## 0.32.0

### Minor Changes

- Add deprecationReason field, searchMembers/searchDocs filter options, private member support

### Patch Changes

- Updated dependencies
  - @openpkg-ts/spec@0.32.0

## 0.31.0

### Minor Changes

- bd70dc7: add diagnostics, filter primitives, new CLI commands (breaking, changelog, diagnostics, filter, semver, validate), registry system, render enhancements

### Patch Changes

- Updated dependencies [bd70dc7]
  - @openpkg-ts/spec@0.31.0

## 0.30.2

### Patch Changes

- fix namespace re-export extraction (export \* as X from './module')

## 0.30.1

### Patch Changes

- fix workspace:\* deps to use published versions for npm compatibility

## 0.30.0

### Minor Changes

- Major monorepo restructure: extract → sdk, doc-generator split into sdk/react/adapters, fumadocs-adapter deleted (use @openpkg-ts/adapters/fumadocs)

## 0.29.0

### Minor Changes

- Add workspace re-export resolution for monorepos using pnpm-workspace.yaml or package.json workspaces

## 0.28.0

### Minor Changes

- Enhanced type extraction: typeOnly flag for re-exports, abstract class/method flags, setter parameter signatures, interface call overload aggregation, x-ts-type extensions for void/unknown/this

## 0.27.2

### Patch Changes

- rm dead formatter.ts, fix node: protocol in test fixtures

## 0.27.1

### Patch Changes

- Updated dependencies
  - @openpkg-ts/spec@0.27.1

## 0.27.0

### Minor Changes

- Add export verification tracking discovered vs extracted exports, --verify CLI flag

## 0.26.0

### Minor Changes

- feat(extract): .d.ts declaration-only mode support

  - Add `isDtsSource` option to ExtractOptions
  - Track degraded mode stats (missing descriptions/params/examples)
  - Improved CLI output for declaration-only extraction
  - Symbol.getDocumentationComment() fallback for preserved docs
  - Generation metadata: `mode` and `limitations` fields

### Patch Changes

- Updated dependencies
  - @openpkg-ts/spec@0.26.0

## 0.25.0

### Minor Changes

- Add onProgress callback to extract() for tracking extraction progress

## 0.24.1

### Patch Changes

- perf: cache type lookups, reduce allocations in ref traversal

## 0.24.0

### Minor Changes

- Add type predicates, inherited members, variance modifiers, and overload JSDoc support

### Patch Changes

- Updated dependencies
  - @openpkg-ts/spec@0.24.0

## 0.23.2

### Patch Changes

- Fix: populate deprecated flag in all serializers and add comprehensive tests

## 0.23.1

### Patch Changes

- fix(extract): detect linked packages as external in forgotten exports

  Types from locally linked packages (paths outside the project's baseDir) are now correctly identified as external. Previously, only types in `node_modules` were detected as external, causing false positive "forgotten export" warnings when using linked packages.

  Changes:

  - Updated `isExternalType` to check if type definition path is outside project baseDir
  - Added comprehensive unit and integration tests for external type detection

## 0.23.0

### Minor Changes

- feat: add JSON Schema 2020-12 normalization

  **@openpkg-ts/spec:**

  - Add `JSONSchemaExtensions` type for TypeScript-specific JSON Schema extensions (`x-ts-type`, `x-ts-function`, `x-ts-signatures`, `x-ts-type-arguments`)
  - Update `SpecSchemaGeneric` to include `Partial<JSONSchemaExtensions>` for extension support

  **@openpkg-ts/extract:**

  - Add `schema-normalizer` module with functions to convert SpecSchema DSL to valid JSON Schema 2020-12
  - New exports: `normalizeSchema`, `normalizeExport`, `normalizeType`, `normalizeMembers`, `NormalizeOptions`, `JSONSchema`
  - Update `extract()` to automatically normalize all schemas to JSON Schema 2020-12 format
  - Update README with comprehensive documentation for JSON Schema output format and TypeScript extension fields

### Patch Changes

- Updated dependencies
  - @openpkg-ts/spec@0.23.0

## 0.22.1

### Patch Changes

- Add schema library detection for variable exports

  - When serializing variable exports, detect if the type is from a schema library (Zod, Valibot, TypeBox, ArkType)
  - Extract and serialize the output type instead of the full schema class internals
  - Add `flags.schemaLibrary` and `flags.hasTransform` metadata to affected exports
  - Fix circular reference handling for anonymous types in schema-builder (inline as object instead of creating invalid `$ref`)

## 0.22.0

### Minor Changes

- Add direct TypeScript execution for runtime schema extraction

  - Auto-detect available TS runtimes: Node 22+ (native), bun, tsx, ts-node
  - Extract Standard JSON Schema from .ts files without requiring a build step
  - `tspec schemas.ts --runtime` now works out of the box
  - Falls back to compiled JS when available for production/CI environments
  - Reports extraction method in output (e.g., "via direct-ts (bun)")

## 0.21.0

### Minor Changes

- Add hybrid schema extraction mode that merges runtime Standard JSON Schema with static type analysis

  - Add `schemaExtraction: 'hybrid'` option to extract runtime schemas from compiled JS
  - Add `schemaTarget` option to specify JSON Schema dialect (draft-2020-12, draft-07, openapi-3.0)
  - Add `runtimeSchemas` metadata to `ExtractResult` with extraction stats
  - Add `mergeRuntimeSchemas` function to merge runtime schemas with static exports
  - Improve `resolveCompiledPath` to read tsconfig.json outDir and support .mjs/.cjs extensions
  - Fix interface extends serialization to use intersection (`&`) instead of array
  - Fix TypeScript API compatibility for JSDoc comment extraction and class member modifiers
  - Fix boolean literal type extraction using `checker.typeToString` instead of `intrinsicName`
  - Fix `withDescription` to handle string schema types

## 0.20.0

### Minor Changes

- Update StandardJSONSchemaV1 interface to match v1 spec

  - Add StandardJSONSchemaTarget type for JSON Schema target versions
  - Add StandardJSONSchemaOptions interface with target and libraryOptions
  - Update StandardJSONSchemaV1 to require both input and output methods
  - Fix isStandardJSONSchema to validate version === 1 and require both methods
  - Pass options object (not string) to jsonSchema methods per spec
  - Add libraryOptions passthrough for vendor-specific parameters
  - Fix forgotten exports detection to skip re-exported types

## 0.19.0

### Minor Changes

- feat(spec): add structured param field to SpecTag for @param tags

  - Add `SpecTagParam` type with name, type, description, and optional fields
  - Add optional `param` field to `SpecTag` for structured @param data
  - Update JSON schema v0.4.0 with `tag.param` and `tagParam` definitions
  - Update normalize.ts to preserve `param` field during normalization
  - Update extract package to populate structured param data from JSDoc @param tags

### Patch Changes

- Updated dependencies
  - @openpkg-ts/spec@0.19.0

## 0.18.3

### Patch Changes

- Update internal package dependency versions

## 0.18.2

### Patch Changes

- chore: migrate workspace dependencies from `workspace:*` to `workspace:^`

  This change updates internal workspace dependency references to use caret ranges (`workspace:^`) instead of exact matches (`workspace:*`). This provides better semver compatibility when packages are published and consumed externally.

## 0.18.1

### Patch Changes

- Code style cleanup: formatting improvements and lint fixes

  - Remove trailing blank line in TypeRegistry class
  - Use template literal syntax for regex pattern
  - Reformat function signature to single line
  - Reorder imports alphabetically in CLI spec
  - Format long option strings with proper line breaks
  - Prefix unused parameter with underscore to silence lint warning

## 0.18.0

### Minor Changes

- feat: add JavaScript file support for entry point detection and compilation

## 0.17.0

### Minor Changes

- Add --only and --ignore CLI flags for filtering exports (supports \* wildcards)

## 0.16.1

### Patch Changes

- fix(extract): strip TSDoc hyphen separator from @param/@typeParam descriptions
  feat(sdk): add @throws tag support to JSDoc writer

## 0.16.0

### Minor Changes

- Add API surface completeness analysis for forgotten exports detection

## 0.15.0

### Minor Changes

- Build structured schemas for registered types using buildSchema instead of type strings

## 0.14.5

### Patch Changes

- feat(extract): serialize namespace members into spec output
  feat(sdk): include namespace members in drift export registry

## 0.14.4

### Patch Changes

- Prefer source entry files over .d.ts, warn when using .d.ts (TSDoc comments may be missing)

## 0.14.3

### Patch Changes

- refactor: extract shared CLI utilities to cli-utils package

  - Move progress, spinner, and output formatting utilities to new cli-utils package
  - Update CLI commands to use shared cli-utils (colors, symbols, summary component)
  - Update extract CLI to use shared cli-utils
  - Remove deprecated progress.ts from CLI
  - Remove outdated doc-generator examples
  - Update package READMEs

## 0.14.2

### Patch Changes

- fix(extract): correct package.json exports path (dist/index.js -> dist/src/index.js)

## 0.14.1

### Patch Changes

- Reduce type explosion: add depth limits to recursive type traversal, expand builtin types set, filter generic params from dangling refs

## 0.14.0

### Minor Changes

- Consolidate type extraction logic into @openpkg-ts/extract package. Removes duplicate serializers from SDK, adds rich type schema extraction with class/interface members and generics support.

## 0.13.0

### Minor Changes

- Add rich type schema extraction with generics and structured output

  - registry.ts: Build shallow schemas for types with $refs, anyOf, generics
  - classes.ts: Extract full class structure (constructors, methods, properties, generics)
  - interfaces.ts: Extract interface members with property/method schemas
  - enums.ts: Build proper enum schemas with values
  - schema-builder.ts: Enhanced schema building with generic type params
  - parameters.ts: Updated parameter extraction for richer schemas

## 0.12.0

### Minor Changes

- feat(extract): rich type schema extraction with generics, unions, intersections, and object literals

  - Rewrite schema-builder to produce structured SpecSchema with proper type discrimination
  - Handle generic types with typeArguments ($ref + typeArguments for user types, expanded for builtins)
  - Support union/intersection types with $union/$intersection arrays
  - Expand object literal types with properties schema
  - Extract function signatures with parameters and returnType
  - Handle tuple types with prefixItems
  - Add expandBindingPattern for destructured params with JSDoc description inheritance

### Patch Changes

- Updated dependencies
  - @openpkg-ts/spec@0.12.0

## 0.11.4

### Patch Changes

- fix: resolve and register referenced types in openpkg spec

  - Add type registration for function parameters, return types, and variables
  - Support namespace exports (`export * as Foo from './foo'`)
  - Filter out builtins, enum members, and generic type parameters
  - Extract JSDoc from namespace export statements

## 0.11.3

### Patch Changes

- fix: replace workspace:\* with hardcoded versions for npm compatibility

## 0.11.2

### Patch Changes

- Parse @example JSDoc tags into examples array with code and language fields

## 0.11.1

### Patch Changes

- Initial release of @openpkg-ts/doc-generator

  - Core API: createDocs(), loadSpec() for loading OpenPkg specs
  - Query utilities: formatSchema(), buildSignatureString(), member filtering and sorting
  - Renderers: Markdown/MDX, HTML, JSON output formats
  - Navigation: Fumadocs, Docusaurus, and generic nav generation
  - Search: Pagefind and Algolia compatible indexes
  - React components: Headless (unstyled) and styled (Tailwind v4) variants
  - CLI: generate, build, dev commands
  - Adapter architecture: Extensible framework integration pattern

- Updated dependencies
  - @openpkg-ts/spec@0.11.1
