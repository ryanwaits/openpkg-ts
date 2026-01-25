# @openpkg-ts/spec

## 0.34.1

### Patch Changes

- Codebase health improvements: bounded caches, path traversal fix, module extraction, stricter linting

## 0.33.0

### Patch Changes

- feat(sdk,cli): external package re-export resolution and config file support

  - Add `--external-include/exclude/depth` flags for resolving re-exports from external packages
  - Add config file support via `openpkg.config.json` or package.json "openpkg" field
  - Add `--verbose` flag showing detailed skipped/external export info
  - Add `SkippedExportDetail` type with skip reasons and package info

## 0.32.0

### Minor Changes

- Add deprecationReason field, searchMembers/searchDocs filter options, private member support

## 0.31.1

### Patch Changes

- fix package exports pointing to src instead of dist

## 0.31.0

### Minor Changes

- bd70dc7: add diagnostics, filter primitives, new CLI commands (breaking, changelog, diagnostics, filter, semver, validate), registry system, render enhancements

## 0.27.1

### Patch Changes

- Add test suite for validate, normalize, and diff modules (76 tests)

## 0.26.0

### Minor Changes

- feat(extract): .d.ts declaration-only mode support

  - Add `isDtsSource` option to ExtractOptions
  - Track degraded mode stats (missing descriptions/params/examples)
  - Improved CLI output for declaration-only extraction
  - Symbol.getDocumentationComment() fallback for preserved docs
  - Generation metadata: `mode` and `limitations` fields

## 0.24.0

### Minor Changes

- Add type predicates, inherited members, variance modifiers, and overload JSDoc support

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

## 0.19.0

### Minor Changes

- feat(spec): add structured param field to SpecTag for @param tags

  - Add `SpecTagParam` type with name, type, description, and optional fields
  - Add optional `param` field to `SpecTag` for structured @param data
  - Update JSON schema v0.4.0 with `tag.param` and `tagParam` definitions
  - Update normalize.ts to preserve `param` field during normalization
  - Update extract package to populate structured param data from JSDoc @param tags

## 0.12.0

### Patch Changes

- feat(extract): rich type schema extraction with generics, unions, intersections, and object literals

  - Rewrite schema-builder to produce structured SpecSchema with proper type discrimination
  - Handle generic types with typeArguments ($ref + typeArguments for user types, expanded for builtins)
  - Support union/intersection types with $union/$intersection arrays
  - Expand object literal types with properties schema
  - Extract function signatures with parameters and returnType
  - Handle tuple types with prefixItems
  - Add expandBindingPattern for destructured params with JSDoc description inheritance

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

## 0.11.0

### Minor Changes

- Remove deprecated `tsType` field in favor of `schema`, add CLI warning when `--runtime` requested without built code

## 0.10.0

### Minor Changes

- Enhanced quality rules, filtering, github context, analysis reports, new API routes (ai, billing, demo, github-app, invites, orgs), trends command, diff capabilities

## 0.9.0

### Minor Changes

- e063639: refactor: replace scan architecture with plan/execute model

  **@doccov/sdk**

  - Add `fetchGitHubContext()` for fetching repository metadata via GitHub API
  - Add `BuildPlan` types for describing build/analysis execution plans
  - Export new scan types: `BuildPlan`, `BuildPlanStep`, `BuildPlanExecutionResult`, `GitHubProjectContext`
  - Remove legacy scan orchestrator in favor of external execution

  **@doccov/cli**

  - Remove `scan` command (moved to API service)
  - Update `spec` command with improved analysis

  **@openpkg-ts/spec**

  - Add `BuildPlan` and related types to schema
  - Extend spec schema for plan-based analysis

## 0.8.0

### Minor Changes

- ### @openpkg-ts/spec

  **Breaking (pre-1.0):** Restructured spec types to move coverage metadata to an enrichment layer:

  - Removed `docs` field from `SpecExport` and `OpenPkg` types (now provided via SDK enrichment)
  - Changed `SpecDocsMetadata.missing` from `SpecDocSignal[]` to `string[]` (now uses rule IDs)
  - Added `DriftType` as a standalone exported type
  - Added `DriftCategory` type with three categories: `structural`, `semantic`, `example`
  - Added `DRIFT_CATEGORIES` mapping, `DRIFT_CATEGORY_LABELS`, and `DRIFT_CATEGORY_DESCRIPTIONS` constants for categorizing and displaying drift issues

  ### @doccov/sdk

  **Breaking (pre-1.0):** Replaced the lint module with a new quality rules engine and added spec-level caching:

  - Removed the `lint` module (`LintConfig`, `LintRule`, `lintExport`, `lintExports`, etc.)
  - Added `quality` module with a flexible rules-based engine:
    - `QualityRule`, `QualityViolation`, `QualityConfig` types
    - `evaluateQuality()`, `evaluateExportQuality()` functions
    - Built-in rules: `CORE_RULES`, `STYLE_RULES`, `BUILTIN_RULES`
  - Added `cache` module for spec-level caching:
    - `loadSpecCache()`, `saveSpecCache()`, `validateSpecCache()`
    - `hashFile()`, `hashFiles()`, `hashString()` utilities
  - Added enrichment layer:
    - `enrichSpec()` function
    - `EnrichedExport`, `EnrichedOpenPkg`, `EnrichedDocsMetadata` types
  - Added unified report generation:
    - `generateReport()`, `generateReportFromEnriched()`
    - `DocCovReport`, `CoverageSummary`, `DriftReport` types
  - Added unified example validation:
    - `validateExamples()` function
    - `parseExamplesFlag()`, `shouldValidate()` utilities
    - `ExampleValidationResult`, `ExampleValidationOptions` types

  ### @doccov/cli

  **Breaking (pre-1.0):** Revamped commands for better UX and added multi-format reporting:

  - Renamed `generate` command to `spec` (generates OpenPkg spec files)
  - Added `info` command for quick package summary (exports, coverage, drift at a glance)
  - Revamped `check` command:
    - Removed options: `--require-examples`, `--exec`, `--no-lint`, `--no-typecheck`, `--ignore-drift`
    - Added options: `--examples [mode]` (presence, typecheck, run), `--max-drift <percentage>`, `--format <format>`, `-o/--output <file>`, `--stdout`, `--no-cache`
    - Now supports multi-format output: text, json, markdown, html, github
    - Writes reports to `.doccov/` directory by default
  - Added spec-level caching (use `--no-cache` to bypass)
  - Simplified config schema to match new quality rules engine

## 0.7.0

### Minor Changes

- feat: spec enhancements

  - Add SpecSchema DSL with discriminated union types for type schemas (primitives, composites, combinators, refs)
  - Add SpecExample structured type with title, description, language, runnable, and expectedOutput fields
  - Add SpecRelation type for expressing relationships between exports (extends, implements, returns, see-also, companion)
  - Add related field to SpecExport and SpecType definitions
  - Update JSON schema with all new definitions

## 0.6.0

### Minor Changes

- add schema definitions to v0.3.0:

  - **Conditional/Mapped Types**: `typeAliasKind`, `conditionalType`, `mappedType` fields with full structural representation
  - **Decorators**: `decorator` definition with name and argumentsText
  - **Module Augmentation**: `isAugmentation` and `augmentedModule` fields
  - **Throws Documentation**: `throwsInfo` definition for @throws JSDoc tags

## 0.5.0

### Minor Changes

- added openpkg schema v0.3.0 with support for function/method overloads, structured jsdoc tag fields

## 0.4.1

### Patch Changes

- improve validation and diff logic

## 0.4.0

### Minor Changes

- add allUndocumented and totalExports/documentedExports stats to DocsImpactResults

## 0.3.0

### Minor Changes

- ## OpenPkg Spec Builder Improvements

  ### New Features

  - **Class inheritance**: Capture `extends` and `implements` clauses
  - **Namespace exports**: Support `export namespace X { ... }`
  - **Function overloads**: Capture all overload signatures
  - **Mapped/conditional types**: Preserve `tsType` for complex types
  - **External types**: Graceful handling with `kind: "external"` stubs
  - **Interface methods**: Serialize method signatures on interfaces
  - **Index signatures**: Capture `[key: string]: T` patterns
  - **Default values**: Preserve parameter defaults
  - **Rest parameters**: Mark with `rest: true`
  - **Getter/setter pairs**: Merge into single member
  - **Call/construct signatures**: Capture callable interfaces
  - **Type predicates**: Preserve `x is string` and `asserts x` returns
  - **Union discriminants**: Add `discriminator: { propertyName }` for tagged unions
  - **Re-export aliasing**: Correctly track `export { X as Y }`

  ### CLI Changes

  - Renamed `--no-external-types` to `--skip-resolve` across all commands
  - Added `--skip-resolve` to `report` and `scan` commands
  - New warnings for unresolved external types
  - Info message when `node_modules` not found

  ### Bug Fixes

  - Fixed circular type reference detection
  - Fixed destructured parameter TSDoc matching
  - Fixed drift detection for destructured params

## 0.2.2

### Patch Changes

- c74cf99: initial release of spec, sdk, and cli packages

## 0.2.1

### Patch Changes

- c74cf99: initial release of spec, sdk, and cli packages
