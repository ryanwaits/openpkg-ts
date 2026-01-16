# @openpkg-ts/ui

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
