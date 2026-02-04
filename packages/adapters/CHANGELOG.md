# @openpkg-ts/adapters

## 0.3.13

### Patch Changes

- Updated dependencies
  - @openpkg-ts/ui@0.6.0

## 0.3.12

### Patch Changes

- Updated dependencies
  - @openpkg-ts/ui@0.5.0

## 0.3.11

### Patch Changes

- Updated dependencies
  - @openpkg-ts/ui@0.4.0

## 0.3.10

### Patch Changes

- Replace GitHub Light/Dark CodeHike themes with custom syntax theme; fix light mode not activating due to missing `.light` class selector
- Updated dependencies
  - @openpkg-ts/ui@0.3.2

## 0.3.9

### Patch Changes

- Replace GitHub Light/Dark CodeHike themes with custom syntax theme
- Updated dependencies
  - @openpkg-ts/ui@0.3.1

## 0.3.8

### Patch Changes

- Updated dependencies
  - @openpkg-ts/ui@0.3.0

## 0.3.7

### Patch Changes

- Updated dependencies
  - @openpkg-ts/ui@0.2.0

## 0.3.6

### Patch Changes

- ui: Add docskit.css stylesheet (codehike theme + dk-\* Tailwind mappings + selection utility) and fix styles/tokens.css packaging by including src/styles in files field.
  adapters: Fix DISPLAY_DISPLAY_KIND_ORDER typo in fumadocs source.
- Updated dependencies
  - @openpkg-ts/ui@0.1.7

## 0.3.5

### Patch Changes

- Updated dependencies
  - @openpkg-ts/sdk@0.35.0
  - @openpkg-ts/ui@0.1.6

## 0.3.4

### Patch Changes

- Codebase health improvements: bounded caches, path traversal fix, module extraction, stricter linting
- Updated dependencies
  - @openpkg-ts/sdk@0.34.1
  - @openpkg-ts/ui@0.1.5
  - @openpkg-ts/spec@0.34.1

## 0.3.3

### Patch Changes

- Updated dependencies
  - @openpkg-ts/sdk@0.34.0
  - @openpkg-ts/ui@0.1.4

## 0.3.2

### Patch Changes

- Updated dependencies
  - @openpkg-ts/sdk@0.33.0
  - @openpkg-ts/spec@0.33.0

## 0.3.1

### Patch Changes

- Updated dependencies
  - @openpkg-ts/spec@0.32.0
  - @openpkg-ts/sdk@0.32.0

## 0.3.0

### Minor Changes

- bd70dc7: add diagnostics, filter primitives, new CLI commands (breaking, changelog, diagnostics, filter, semver, validate), registry system, render enhancements

### Patch Changes

- Updated dependencies [bd70dc7]
  - @openpkg-ts/spec@0.31.0
  - @openpkg-ts/sdk@0.31.0

## 0.2.2

### Patch Changes

- update @openpkg-ts/sdk dependency to ^0.30.2

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
