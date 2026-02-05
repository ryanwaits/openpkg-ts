# @openpkg-ts/cli

## 0.6.3

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
  - @openpkg-ts/sdk@0.35.1
  - @openpkg-ts/adapters@0.3.14

## 0.6.2

### Patch Changes

- Add configurable maxProperties limit with onTruncation callback for object type serialization
- Updated dependencies
  - @openpkg-ts/sdk@0.35.0
  - @openpkg-ts/adapters@0.3.5

## 0.6.1

### Patch Changes

- Codebase health improvements: bounded caches, path traversal fix, module extraction, stricter linting
- Updated dependencies
  - @openpkg-ts/sdk@0.34.1
  - @openpkg-ts/adapters@0.3.4

## 0.6.0

### Minor Changes

- CLI: docs subcommands (generate/init/add/list), spec subcommand, component registry
  SDK: browser export, query builder API
  React: new headless/styled components, adapters

### Patch Changes

- Updated dependencies
  - @openpkg-ts/sdk@0.34.0
  - @openpkg-ts/adapters@0.3.3

## 0.5.1

### Patch Changes

- Fix local re-export resolution when extended tsconfig can't be resolved. Now includes all tsconfig.fileNames in program root files so tsx re-exports resolve correctly.
- Updated dependencies
  - @openpkg-ts/sdk@0.33.1

## 0.5.0

### Minor Changes

- feat(sdk,cli): external package re-export resolution and config file support

  - Add `--external-include/exclude/depth` flags for resolving re-exports from external packages
  - Add config file support via `openpkg.config.json` or package.json "openpkg" field
  - Add `--verbose` flag showing detailed skipped/external export info
  - Add `SkippedExportDetail` type with skip reasons and package info

### Patch Changes

- Updated dependencies
  - @openpkg-ts/sdk@0.33.0
  - @openpkg-ts/adapters@0.3.2

## 0.4.2

### Patch Changes

- Fix optional parameter detection and arrow function serialization

  - Optional params (`?` or default values) now correctly marked `required: false`
  - Arrow function consts now serialize as `kind: 'function'` instead of `kind: 'variable'`

- Updated dependencies
  - @openpkg-ts/sdk@0.32.1

## 0.4.1

### Patch Changes

- fix stale version in built artifacts

## 0.4.0

### Minor Changes

- Add deprecationReason field, searchMembers/searchDocs filter options, private member support

### Patch Changes

- Updated dependencies
  - @openpkg-ts/sdk@0.32.0
  - @openpkg-ts/adapters@0.3.1

## 0.3.1

### Patch Changes

- fix package exports pointing to src instead of dist

## 0.3.0

### Minor Changes

- bd70dc7: add diagnostics, filter primitives, new CLI commands (breaking, changelog, diagnostics, filter, semver, validate), registry system, render enhancements

### Patch Changes

- Updated dependencies [bd70dc7]
  - @openpkg-ts/sdk@0.31.0
  - @openpkg-ts/adapters@0.3.0

## 0.2.3

### Patch Changes

- update @openpkg-ts/sdk dependency to ^0.30.2

## 0.2.2

### Patch Changes

- pull version from package.json instead of hardcoding

## 0.2.1

### Patch Changes

- fix workspace:\* deps to use published versions for npm compatibility
- Updated dependencies
  - @openpkg-ts/sdk@0.30.1

## 0.2.0

### Minor Changes

- Major monorepo restructure: extract → sdk, doc-generator split into sdk/react/adapters, fumadocs-adapter deleted (use @openpkg-ts/adapters/fumadocs)

### Patch Changes

- Updated dependencies
  - @openpkg-ts/sdk@0.30.0
