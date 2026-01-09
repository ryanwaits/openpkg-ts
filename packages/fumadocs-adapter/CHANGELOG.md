# @openpkg-ts/fumadocs-adapter

## 0.6.15

### Patch Changes

- Updated dependencies
  - @openpkg-ts/spec@0.26.0
  - @openpkg-ts/doc-generator@0.6.13

## 0.6.14

### Patch Changes

- Updated dependencies
  - @openpkg-ts/spec@0.24.0
  - @openpkg-ts/doc-generator@0.6.12

## 0.6.13

### Patch Changes

- chore: bump @openpkg-ts/spec dependency for JSON Schema extensions support
- Updated dependencies
- Updated dependencies
  - @openpkg-ts/doc-generator@0.6.11
  - @openpkg-ts/spec@0.23.0

## 0.6.12

### Patch Changes

- feat(spec): add structured param field to SpecTag for @param tags

  - Add `SpecTagParam` type with name, type, description, and optional fields
  - Add optional `param` field to `SpecTag` for structured @param data
  - Update JSON schema v0.4.0 with `tag.param` and `tagParam` definitions
  - Update normalize.ts to preserve `param` field during normalization
  - Update extract package to populate structured param data from JSDoc @param tags

- Updated dependencies
  - @openpkg-ts/spec@0.19.0
  - @openpkg-ts/doc-generator@0.6.10

## 0.6.11

### Patch Changes

- Update internal package dependency versions
- Updated dependencies
  - @openpkg-ts/doc-generator@0.6.9

## 0.6.10

### Patch Changes

- chore: migrate workspace dependencies from `workspace:*` to `workspace:^`

  This change updates internal workspace dependency references to use caret ranges (`workspace:^`) instead of exact matches (`workspace:*`). This provides better semver compatibility when packages are published and consumed externally.

- Updated dependencies
  - @openpkg-ts/doc-generator@0.6.8

## 0.6.9

### Patch Changes

- Updated dependencies
  - @openpkg-ts/ui@0.1.2
  - @openpkg-ts/doc-generator@0.6.7

## 0.6.8

### Patch Changes

- fix: replace workspace:\* with hardcoded versions for npm compatibility
- Updated dependencies
  - @openpkg-ts/doc-generator@0.6.5

## 0.6.7

### Patch Changes

- Updated dependencies
  - @openpkg-ts/ui@0.1.1
  - @openpkg-ts/doc-generator@0.6.4

## 0.6.6

### Patch Changes

- Add explicit type annotations to CVA variants and forwardRef components for better TypeScript inference
- Updated dependencies
  - @doccov/ui@0.3.2

## 0.6.5

### Patch Changes

- feat: add namespace/module/reference/external kind badges and refactor sidebar badge to use @doccov/ui
- Updated dependencies
  - @openpkg-ts/doc-generator@0.6.3

## 0.6.4

### Patch Changes

- fix: use node.icon for kind badges to avoid react key warning

## 0.6.3

### Patch Changes

- fix: wrap sidebar node name in keyed span to fix react key warning

## 0.6.2

### Patch Changes

- refactor: simplify css vars, use codehike theme colors, fix react key warnings
- Updated dependencies
  - @openpkg-ts/doc-generator@0.6.2

## 0.6.1

### Patch Changes

- fix: correct pluralization for class/interface slugs (classes not classs)
- Updated dependencies
  - @openpkg-ts/doc-generator@0.6.1

## 0.6.0

### Minor Changes

- add single-page mode and TOC navigation to FullAPIReferencePage

### Patch Changes

- Updated dependencies
  - @openpkg-ts/doc-generator@0.6.0

## 0.5.2

### Patch Changes

- feat: add FullAPIReferencePage and section-based architecture

  - Add FullAPIReferencePage for single-page API reference rendering
  - Add section components (FunctionSection, ClassSection, etc.) for composability
  - Refactor existing page components to use section components

- Updated dependencies
  - @openpkg-ts/doc-generator@0.5.1

## 0.5.1

### Patch Changes

- Add FullAPIReferencePage component and refactor to section-based architecture

  - New FullAPIReferencePage: single-page API ref with kind filtering
  - New section components: FunctionSection, ClassSection, InterfaceSection, EnumSection, VariableSection, ExportSection
  - Refactored page components to use sections internally (reduces duplication)
  - Export sections from doc-generator and fumadocs-adapter for custom layouts

- Updated dependencies
  - @openpkg-ts/doc-generator@0.5.0

## 0.5.0

### Minor Changes

- Add Stripe-style API reference components (APIParameterItem, ParameterList, ResponseBlock, APICodePanel, LanguageSelector, APISection) and refactor styled pages to use DocsKit components

### Patch Changes

- Updated dependencies
  - @openpkg-ts/doc-generator@0.4.0

## 0.4.3

### Patch Changes

- Bump for doc-generator DocsKit code block improvements
- Updated dependencies
  - @openpkg-ts/doc-generator@0.3.4

## 0.4.2

### Patch Changes

- Fix @doccov/ui build - separate entry points to avoid duplicate exports
- Updated dependencies
  - @openpkg-ts/doc-generator@0.3.2

## 0.4.1

### Patch Changes

- Publish @doccov/ui and bump dependent packages
- Updated dependencies
  - @openpkg-ts/doc-generator@0.3.1

## 0.4.0

### Minor Changes

- Extract shared API components to @doccov/ui package

  - New @doccov/ui/api entry: ParameterItem, TypeBadge, ImportSection, CodeTabs, ExportCard
  - Updated FunctionPage, InterfacePage, ClassPage, ExportIndexPage with improved layouts
  - Added Tailwind v4 theme vars and Stripe-style function page CSS
  - Re-export components through doc-generator and fumadocs-adapter

### Patch Changes

- Updated dependencies
  - @openpkg-ts/doc-generator@0.3.0

## 0.3.2

### Patch Changes

- chore: bump doc-generator with ExportIndexPage link fix
- Updated dependencies
  - @openpkg-ts/doc-generator@0.2.4

## 0.3.1

### Patch Changes

- chore: bump doc-generator dependency with JSX runtime fix
- Updated dependencies
  - @openpkg-ts/doc-generator@0.2.3

## 0.3.0

### Minor Changes

- Add Fumadocs virtual source and loader plugin for seamless integration

### Patch Changes

- Updated dependencies
  - @openpkg-ts/doc-generator@0.2.2

## 0.2.5

### Patch Changes

- fix: bump doc-generator dep for styled component exports

## 0.2.4

### Patch Changes

- feat(doc-generator): add AI SDK-style API reference components

  - Add CodeTabs: tabbed code blocks with copy button
  - Add ExportCard: clickable cards for export index grid
  - Add ExportIndexPage: category-grouped exports grid
  - Add ImportSection: copyable import statement display
  - Add ParameterItem: expandable nested params display
  - Update FunctionPage with improved layout
  - Update APIPage to support index mode
  - Add CSS vars for new components

- Updated dependencies
  - @openpkg-ts/doc-generator@0.2.0

## 0.2.3

### Patch Changes

- fix: bump doc-generator dep for Turbopack compatibility

## 0.2.2

### Patch Changes

- fix package exports to point to dist/ instead of src/ for bundler compatibility

## 0.2.1

### Patch Changes

- version bump for republish

## 0.2.0

### Minor Changes

- Rename package from @doccov/fumadocs-adapter to @openpkg-ts/fumadocs-adapter

## 0.1.0

### Minor Changes

- Initial release of @openpkg-ts/doc-generator

  - Core API: createDocs(), loadSpec() for loading OpenPkg specs
  - Query utilities: formatSchema(), buildSignatureString(), member filtering and sorting
  - Renderers: Markdown/MDX, HTML, JSON output formats
  - Navigation: Fumadocs, Docusaurus, and generic nav generation
  - Search: Pagefind and Algolia compatible indexes
  - React components: Headless (unstyled) and styled (Tailwind v4) variants
  - CLI: generate, build, dev commands
  - Adapter architecture: Extensible framework integration pattern

### Patch Changes

- Updated dependencies
  - @openpkg-ts/doc-generator@0.1.0

## 0.0.3

### Patch Changes

- Remove deprecated `tsType` field in favor of `schema`, add CLI warning when `--runtime` requested without built code

## 0.0.2

### Patch Changes

- update components and configuration
