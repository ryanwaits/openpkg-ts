# @openpkg-ts/extract

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
