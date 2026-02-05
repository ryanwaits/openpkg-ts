# @openpkg-ts/ui

## 0.7.0

### Minor Changes

- Add single-column theme for API reference

  **@openpkg-ts/ui:**

  - Add `SectionAccordion` component - collapsible section with header toggle
  - Add `APISectionSingle` component - single-column 780px centered layout
  - Add `theme` prop to `APIReferencePage` (`'default' | 'single'`)
  - Export new components from docskit barrel

  **@openpkg-ts/sdk, @openpkg-ts/cli, @openpkg-ts/adapters, @openpkg-ts/spec:**

  - Lint fixes (biome)

### Patch Changes

- Updated dependencies
  - @openpkg-ts/sdk@0.35.1
  - @openpkg-ts/spec@0.35.1

## 0.6.2

### Patch Changes

- ## Bug Fixes

  - **Fix diff/mark annotations not rendering**: Fixed handler order in `code.handlers.tsx` - `diff` and `mark` handlers must come before `line` handler to set CSS variables correctly
  - **Fix malformed className in code.line.tsx**: Moved CSS transition from className string to style object

  ## New Features

  - **Add RunnableSnippet component**: Interactive code block with run button and output display (Phase 1 - mock execution, sandbox deferred)

  ## Registry Improvements

  - **Auto-expandable parameters**: Updated `function-section` and `class-section` to use `ExpandableParameter` for all function/constructor parameters
  - Parameters with nested object properties now automatically show expand/collapse toggles
  - No manual wiring required - works out of the box when installed via `shadcn add`

## 0.6.1

### Patch Changes

- fix(ui): improve nested parameter toggle styling and layout alignment

  - Update nested parameter toggle to Stripe-style with dynamic width
  - Add smooth transition for width and border-radius changes
  - Update toggle sizing: px-2 py-1.5 for compact appearance
  - Add lg:items-start to API reference layout for better alignment

## 0.6.0

### Minor Changes

- feat(ui): add resolveRef prop to ExpandableParameter for deep nested $ref resolution

  - Add optional `resolveRef` callback prop to ExpandableParameter
  - Recursively pass resolveRef to nested children
  - Update extractSchemaInfo to resolve $ref schemas before extracting properties
  - Update stripe-api-reference registry component to pass resolveRef callback

  Nested object types referenced via `$ref` (e.g., `profile: { "$ref": "#/types/UserProfile" }`) now properly expand to show their child properties.

## 0.5.2

### Patch Changes

- Add explicit type annotations for cva variants (isolatedDeclarations)

## 0.5.1

### Patch Changes

- Restyle parameter components to match Scalar/Clerk design: unified toggle+container border box, +/× text prefixes, orange "required" text, remove "Expandable" badge and Link icon

## 0.5.0

### Minor Changes

- Add API reference components to docskit: NestedParameterToggle, NestedParameterContainer, EnumValuesSection, CollapsiblePanel, ExampleChips, CodeBlock, ExpandableParameter, MethodSection, ExampleSection, APIReferenceLayout, and SyncScrollProvider hook. Replace APIParameterItem with enhanced Stripe-style version supporting parentPath, anchors, and ReactNode children.

## 0.4.0

### Minor Changes

- Unify styling under --openpkg-\* CSS custom properties, fix cva type errors, remove legacy code tabs

## 0.3.2

### Patch Changes

- Replace GitHub Light/Dark CodeHike themes with custom syntax theme; fix light mode not activating due to missing `.light` class selector

## 0.3.1

### Patch Changes

- Replace GitHub Light/Dark CodeHike themes with custom syntax theme

## 0.3.0

### Minor Changes

- Unify all docskit and registry components under --openpkg-\* CSS vars. Adds 13 new design tokens (accent colors, card surfaces, primary). Replaces shadcn classes and hardcoded Tailwind colors. Fixes enum-values-section rgba() bug.

## 0.2.0

### Minor Changes

- Make components theme-agnostic: remove all hardcoded dark fallbacks from registry components, flip tokens.css to light-first defaults with dark mode via .dark/[data-theme="dark"]/prefers-color-scheme. Consumers override --openpkg-\* vars to match their theme.

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
