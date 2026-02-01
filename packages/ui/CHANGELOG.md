# @openpkg-ts/ui

## 0.1.7

### Patch Changes

- ui: Add docskit.css stylesheet (codehike theme + dk-\* Tailwind mappings + selection utility) and fix styles/tokens.css packaging by including src/styles in files field.
  adapters: Fix DISPLAY_DISPLAY_KIND_ORDER typo in fumadocs source.

## 0.1.6

### Patch Changes

- Add configurable maxProperties limit with onTruncation callback for object type serialization

## 0.1.5

### Patch Changes

- Codebase health improvements: bounded caches, path traversal fix, module extraction, stricter linting

## 0.1.4

### Patch Changes

- CLI: docs subcommands (generate/init/add/list), spec subcommand, component registry
  SDK: browser export, query builder API
  React: new headless/styled components, adapters

## 0.1.3

### Patch Changes

- Expand peer deps to allow React 18 (`react@^18 || ^19`)

## 0.1.2

### Patch Changes

- Add explicit return types to exported functions for TypeScript declaration emit

  - Add `React.JSX.Element` return types to React components
  - Add `Promise<React.JSX.Element>` return types to async React components
  - Add `CodeOptions` return type to `flagsToOptions` function
  - Add `AnnotationHandler[]` type annotation to `collapse` export
  - Eliminates TS9007/TS9013/TS9017 build warnings

## 0.1.1

### Patch Changes

- Remove unused enrichment/diff code from SDK, delete unused UI components (drift-command-center, fix-workflow, pr-coverage)
