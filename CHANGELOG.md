# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Breaking Changes

#### `@openpkg-ts/extract`

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

- `normalizeSchema()` - Convert SpecSchema DSL to JSON Schema 2020-12
- `normalizeExport()` - Normalize a SpecExport including nested schemas
- `normalizeType()` - Normalize a SpecType including nested schemas
- `normalizeMembers()` - Convert members array to JSON Schema properties
- `NormalizeOptions` type for configuring normalization behavior
- Support for `draft-07` dialect via `dialect` option

#### `@openpkg-ts/spec`

- JSON Schema extension types: `JSONSchemaExtensions`, `FunctionSchemaExtension`, `TypeArgumentsExtension`, `AccessorExtension`
