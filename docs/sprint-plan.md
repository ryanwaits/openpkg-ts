# Phase 1: Component Consolidation Sprint Plan

## Sprint 1 — Gut Headless, Clean React Exports

**Goal:** Remove headless components, make `@openpkg-ts/react` export only styled.

### Task 1.1: Delete headless + deprecated, rewrite entry points
**Files to delete:**
- `packages/react/src/components/headless/` (entire directory, 15 files)
- `packages/react/src/components/styled/ParameterItem.tsx`

**Files to keep:**
- `packages/react/src/components/shared.ts` (used by styled/ExportIndexPage + styled/FullAPIReferencePage)

**Files to edit:**
- `packages/react/src/components/styled/index.ts` — remove ParameterItem, ParameterItemProps, NestedPropertyItemProps exports
- `packages/react/src/styled.ts` — remove `export * from './components/headless'` (line 23), remove ParameterItemProps/NestedPropertyItemProps from type exports
- `packages/react/src/index.ts` — replace all headless exports with `export * from './styled'`

**Validate:** `cd packages/react && bun run typecheck && bun run build`

### Task 1.2: Fix tests
- Update `packages/react/src/components/__tests__/snapshots.test.tsx` — remove headless imports if any
- Run `cd packages/react && bun test` — update snapshots if needed
- **Validate:** all test files pass

**Sprint 1 demo:** `bun run build` from root. `bun test` in packages/react. Only styled components exported.

---

## Sprint 2 — Merge ui/api into ui/docskit

**Goal:** Single primitive layer at `@openpkg-ts/ui/docskit`. Kill `./api` export.

### Task 2.1: Move useful api components into docskit
- Move `packages/ui/src/api/CodeTabs.tsx` → `packages/ui/src/docskit/code.tabs-legacy.tsx`
- Move `packages/ui/src/api/ImportSection.tsx` → `packages/ui/src/docskit/import-section.tsx`
- Move `packages/ui/src/api/TypeBadge.tsx` → `packages/ui/src/docskit/type-badge.tsx`
- Add all three to `packages/ui/src/docskit/index.ts` exports
- **Validate:** `cd packages/ui && bun run typecheck`

### Task 2.2: Delete ui/api, update downstream
- Delete `packages/ui/src/api/` entirely
- Remove `"./api"` from `packages/ui/package.json` exports
- Remove `api/index.ts` entry from bunup config (check `bunup.config.ts` or `package.json` scripts)
- Update `packages/react/src/components/styled/index.ts` lines 4-10: `'@openpkg-ts/ui/api'` → `'@openpkg-ts/ui/docskit'`
- Grep entire repo for any remaining `@openpkg-ts/ui/api` imports, fix all
- **Validate:** `bun run build` from root succeeds (all packages)

**Sprint 2 demo:** Full monorepo build. `@openpkg-ts/ui/api` gone. Primitives consolidated under `ui/docskit`.

---

## Sprint 3 — Replace CodePanel with CodeHike

**Goal:** All code rendering uses CodeHike. No custom regex highlighter.

### Task 3.1: Create CodeHike wrapper, replace CodePanel
- Read `packages/react/src/components/styled/CodePanel.tsx` props: `{ code, language, className }`
- Read `packages/ui/src/docskit/api/api-code-panel.tsx` props
- Create `packages/react/src/components/styled/CodeBlock.tsx` — thin wrapper around docskit CodeHike component, matching `{ code: string, language: string, className?: string }` interface
- Update `ExampleSection.tsx` to import CodeBlock instead of CodePanel
- Check `CollapsiblePanel.tsx` for CodePanel usage, update if needed
- Delete `CodePanel.tsx`
- Update `styled/index.ts` — replace CodePanel export with CodeBlock (export `CodeBlock as CodePanel` for compat if needed)
- Update `styled.ts` exports accordingly
- **Validate:** `cd packages/react && bun run typecheck && bun run build`

### Task 3.2: Tests + snapshots
- `cd packages/react && bun test` — update snapshots
- **Validate:** all tests pass

**Sprint 3 demo:** All code blocks use CodeHike. Build passes, tests pass. Grep for `dangerouslySetInnerHTML` in react/styled returns zero results.

---

## Sprint 4 — Final Verification

**Goal:** Clean exports, no duplicates, no dead code.

### Task 4.1: Audit exports
- List all exports from `@openpkg-ts/ui/docskit` and `@openpkg-ts/react/styled`
- Verify no duplicate component names across packages
- Remove any unused/orphaned files
- **Validate:** documented in PR description

### Task 4.2: Full build + test
- `bun run build` from root
- `bun test` from root
- `bun run typecheck` in all three packages (ui, react, adapters)
- **Validate:** zero failures

### Task 4.3: Verify package.json exports are correct
- `packages/ui/package.json`: `./docskit`, `./badge`, `./lib/utils`, `./styles/tokens.css` (no `./api`)
- `packages/react/package.json`: `.` and `./styled`
- **Validate:** build succeeds, exports resolve

**Sprint 4 demo:** Clean monorepo. All tests pass. Single export surface: `ui/docskit` = primitives, `react/styled` = spec-aware components. Ready for Phase 2.
