# Phase 2: Stripe Design Refinement Sprint Plan

> **Note:** File paths below reference `packages/ui` and `packages/react` which no longer exist. All docskit components now live in `packages/registry/registry/new-york/docskit/`. Component names like `StripeAPIReferencePage` have been renamed to `APIReferencePage`. The design work described here still applies — just target the registry paths.

Reference: https://docs.stripe.com/api/customers

Approach: iterative visual design using `/frontend-design` skill. Each sprint produces a demoable improvement. We refine by comparing against Stripe side-by-side after each sprint.

---

## Sprint 1 — Layout, Typography & Color Foundation

**Goal:** Nail the two-column layout, color system, and typography in one pass. These are co-dependent — can't validate one without the others.

### Task 1.1: Restyle StripeAPIReferencePage + APIReferenceLayout
- **Layout:** ~55/45 left/right split. Left: light bg, generous padding (48px+). Right: dark bg, sticky, full-height. Clear vertical divider.
- **Colors:** Left: white bg (#fff), dark text (#3c4257). Right: dark navy (#0a2540). Borders: #e3e8ee (left), subtle on right. Links: configurable accent.
- **Typography:** System font stack. Titles: 24px/600. Body: 15px/400 #3c4257. Mono: 13px SF Mono. Params: 13px/600 mono.
- **Section dividers:** Horizontal rules between method sections, 48-64px vertical spacing.
- Update `--openpkg-*` CSS variable defaults on the page wrapper.
- **Files:** `StripeAPIReferencePage.tsx`, `APIReferenceLayout.tsx`, `MethodSection.tsx`
- **Validate:** `bun run build` succeeds. Use `/frontend-design` to compare side-by-side with Stripe. Layout proportions, colors, and type scale match.

**Sprint 1 demo:** StripeAPIReferencePage renders light-left/dark-right two-column layout with Stripe typography and section dividers.

---

## Sprint 2 — Parameter List Styling

**Goal:** Match Stripe's parameter display — dotted borders, nested indentation, text-link toggles.

### Task 2.1: Restyle parameter components
- **APIParameterItem:** Name (mono, bold) + type (gray, inline) + required badge (small). Dotted bottom borders. Description below in lighter gray. Anchor on hover.
- **NestedParameterToggle:** Replace bordered button with "Show child attributes" text link + chevron.
- **NestedParameterContainer:** Left-border indentation (2px solid #e3e8ee) + padding-left. No box wrapper.
- **ExpandableParameter:** Verify composition of above. Test 3+ nested levels.
- **Files:** `APIParameterItem.tsx`, `NestedParameterToggle.tsx`, `NestedParameterContainer.tsx`, `ExpandableParameter.tsx`
- **Validate:** `bun run build && bun test` in react. Nested expansion works. Use `/frontend-design` to compare params against Stripe.

**Sprint 2 demo:** Params render with Stripe-style dotted borders, inline types, text-link toggle, left-border nested indentation.

---

## Sprint 3 — Right Column: Code Panels & Response Blocks

**Goal:** Match Stripe's dark code panel, language tabs, response display.

### Task 3.1: Restyle right-column components
- **ExampleChips → tabs:** Move language selector into code panel header as horizontal tabs. Active: subtle bg highlight.
- **CodeBlock:** Dark navy bg (#0a2540), rounded corners, minimal border. Ensure CodeHike theme matches Stripe syntax colors. Copy button on hover.
- **CollapsiblePanel:** Response as dark panel below code. "Response" label, expandable, syntax-highlighted JSON.
- **ExampleSection:** Proper spacing between tabs, code, response. Verify sync scroll alignment.
- **Files:** `ExampleChips.tsx`, `CodeBlock.tsx`, `CollapsiblePanel.tsx`, `ExampleSection.tsx`
- **Validate:** `bun run build && bun test`. Use `/frontend-design` to compare right column against Stripe.

**Sprint 3 demo:** Dark code panels with integrated language tabs, response blocks. Synced with left column scroll.

---

## Sprint 4 — Index Page & Final Polish

**Goal:** Refine index page, export cards, method headers. Full QA pass.

### Task 4.1: Restyle ExportCard + ExportIndexPage
- Cards: subtle border, kind badge, hover shadow (no translate). Clean header, search, category grouping.
- **Files:** `ExportCard.tsx`, `ExportIndexPage.tsx`
- **Validate:** build succeeds, index page is clean

### Task 4.2: Method section header refinement
- Method name as anchor with return type badge. "Parameters" subheading with uppercase tracking. Returns section below params.
- **Files:** `MethodSection.tsx`, `MethodSectionFromSpec.tsx`
- **Validate:** build succeeds, method headers match Stripe

### Task 4.3: Full build + test + visual QA
- `bun run build` from root
- `bun test` in packages/react — all tests pass
- Final `/frontend-design` comparison against Stripe
- **Validate:** zero failures, design matches reference

**Sprint 4 demo:** Complete Stripe-style API reference. Index + detail pages polished. Ready for Phase 3 (working fumadocs example).
