# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Breaking Changes

#### `@openpkg-ts/sdk`

- **JSON Schema 2020-12 Output**: All schema output is now normalized to valid JSON Schema 2020-12. This ensures consistency between static TypeScript analysis and runtime schema extraction (Zod, Valibot, etc.).

  **Key changes:**
  - Interfaces and classes now include a `schema` property with JSON Schema `properties` and `required` arrays
  - TypeScript-specific constructs use `x-ts-*` extension fields:
    - `x-ts-type`: Preserves original TypeScript type (e.g., `bigint`, `symbol`)
    - `x-ts-function`: Marks function types
    - `x-ts-signatures`: Function/method signatures
    - `x-ts-type-arguments`: Generic type arguments
    - `x-ts-accessor`: Getter/setter markers
  - Type mappings: `void`/`undefined` → `null`, `never` → `{ "not": {} }`, `any`/`unknown` → `{}`
  - Tuples use `prefixedItems` instead of `items` array

### Added

#### `@openpkg-ts/sdk`

- **Extraction Warnings**: Schema extraction now tracks non-fatal warnings instead of silently skipping failures
  - New `ExtractionWarning` type with codes: `SCHEMA_FAILED`, `TYPEBOX_FAILED`, `PARSE_FAILED`, `CLEANUP_FAILED`, `TSCONFIG_INVALID`
  - `StandardSchemaExtractionOutput.warnings` array captures individual schema failures
  - `ExtractResult.runtimeSchemas.warnings` propagates warnings to extraction results
  - Warnings are also added to `diagnostics` array with appropriate codes

#### `@openpkg-ts/cli`

- `openpkg spec snapshot --quiet` - Suppress extraction warnings in output
- `openpkg spec snapshot --strict` - Exit 1 if any extraction warnings present

- `normalizeSchema()` - Convert SpecSchema DSL to JSON Schema 2020-12
- `normalizeExport()` - Normalize a SpecExport including nested schemas
- `normalizeType()` - Normalize a SpecType including nested schemas
- `normalizeMembers()` - Convert members array to JSON Schema properties
- `NormalizeOptions` type for configuring normalization behavior
- Support for `draft-07` dialect via `dialect` option

#### `@openpkg-ts/spec`

- JSON Schema extension types: `JSONSchemaExtensions`, `FunctionSchemaExtension`, `TypeArgumentsExtension`, `AccessorExtension`
