# @openpkg-ts/cli

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
