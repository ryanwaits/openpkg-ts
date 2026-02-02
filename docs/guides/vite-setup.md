# OpenPKG + Vite + React + Tailwind v4 Setup

End-to-end guide for rendering OpenPKG registry components in a new Vite project.

## 1. Create Vite project

```bash
bun create vite my-app --template react-ts
cd my-app
bun install
```

## 2. Install Tailwind CSS v4

```bash
bun add tailwindcss @tailwindcss/vite
```

**vite.config.ts:**

```ts
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

**src/index.css** (replace contents):

```css
@import "tailwindcss";
```

## 3. Set up path aliases

Both `tsconfig.json` and `tsconfig.app.json` need:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

> Without `baseUrl` + `paths`, `shadcn init` will fail alias validation.

## 4. Initialize shadcn

```bash
bunx shadcn@latest init
```

Choose: **New York** style, **Neutral** base color, **CSS variables** yes.

## 5. Configure the OpenPKG registry

Edit `components.json` to add `registries`:

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "registries": {
    "@openpkg-ts": "https://openpkg.dev/r/{name}.json"
  }
}
```

## 6. Install components

```bash
bunx shadcn@latest add @openpkg-ts/stripe-api-reference
```

This pulls ~15 files with full transitive dependency resolution (components, hooks, lib utils).

Other available components:

```
api-parameter-item    code-block            collapsible-panel
example-chips         export-card           method-section
expandable-parameter  example-section       api-reference-layout
full-api-reference    export-index-page     api-page
```

## 7. Add required CSS

This is the most critical step. Without these additions, components render but look broken.

Add to `src/index.css` after `@import "tailwindcss"`:

```css
@import "tailwindcss";

/* OpenPKG styles — codehike theme, dk-* mappings, design tokens */
@import "@openpkg-ts/ui/styles/docskit.css";
@import "@openpkg-ts/ui/styles/tokens.css";

/* Tell Tailwind to scan docskit bundle for dk-* utility classes */
@source "../node_modules/@openpkg-ts/ui/dist/docskit";
```

That's it. The two CSS imports provide:
- **docskit.css** — CodeHike `--ch-*` theme variables (dark + light), `dk-*` Tailwind color mappings, selection utility
- **tokens.css** — OpenPKG design tokens (`--openpkg-*` vars for backgrounds, text, borders, fonts, radii)

The `@source` directive is still required because Tailwind v4 doesn't scan `node_modules` by default, so it won't see the `dk-*` classes used inside the bundled docskit JS.

## 8. Theming

Components are **light by default** and respond to dark mode via:
- `.dark` class on `<html>` (shadcn convention)
- `[data-theme="dark"]` attribute
- `prefers-color-scheme: dark` system preference

All colors use `--openpkg-*` CSS custom properties. Override any variable to match your theme:

```css
/* Example: custom brand colors */
:root {
  --openpkg-bg-root: #fefefe;
  --openpkg-accent-link: #0066cc;
}

.dark {
  --openpkg-bg-root: #111111;
  --openpkg-accent-link: #66b3ff;
}
```

Available token categories: `--openpkg-bg-*`, `--openpkg-text-*`, `--openpkg-border-*`, `--openpkg-accent-*`, `--openpkg-syn-*`, `--openpkg-font-*`, `--openpkg-radius-*`. See `tokens.css` for the full list.

## 9. Usage

**src/App.tsx:**

```tsx
import type { OpenPkg } from "@openpkg-ts/spec";
import { StripeAPIReferencePage } from "@/components/stripe-api-reference/stripe-api-reference";

const spec: OpenPkg = {
  $schema: "https://openpkg.dev/schema.json",
  meta: {
    name: "@example/sdk",
    version: "1.0.0",
    description: "Example SDK",
  },
  exports: [
    {
      id: "createClient",
      name: "createClient",
      kind: "function",
      description: "Create a new API client instance.",
      signatures: [
        {
          parameters: [
            {
              name: "apiKey",
              schema: { type: "string" },
              required: true,
              description: "Your API key",
            },
            {
              name: "options",
              schema: {
                type: "object",
                properties: {
                  baseUrl: { type: "string", description: "Custom base URL" },
                  timeout: { type: "number", description: "Timeout in ms" },
                },
              },
              required: false,
              description: "Configuration options",
            },
          ],
          returns: {
            schema: { type: "object" },
            description: "A configured client instance",
          },
        },
      ],
      examples: [
        {
          title: "Basic",
          code: `import { createClient } from '@example/sdk';\n\nconst client = createClient('sk_test_123');`,
          language: "typescript",
        },
      ],
    },
    {
      id: "listItems",
      name: "listItems",
      kind: "function",
      description: "List all items with optional filtering.",
      signatures: [
        {
          parameters: [
            {
              name: "filter",
              schema: { type: "object" },
              required: false,
              description: "Filter criteria",
            },
          ],
          returns: {
            schema: { type: "array" },
            description: "Array of items",
          },
        },
      ],
      examples: [
        {
          title: "Basic",
          code: `const items = await listItems({ status: 'active' });`,
          language: "typescript",
        },
      ],
    },
  ],
};

function App() {
  return <StripeAPIReferencePage spec={spec} />;
}

export default App;
```

Run the dev server:

```bash
bun run dev
```

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| No syntax highlighting in code blocks | Missing `--ch-*` CSS variables | Add `@import "@openpkg-ts/ui/styles/docskit.css"` (step 7) |
| No copy button / broken code block chrome | Tailwind not generating `dk-*` utilities | Add `@source` directive + docskit.css import (step 7) |
| `shadcn init` fails on alias validation | Missing `baseUrl`/`paths` in tsconfig | Add path aliases to both `tsconfig.json` and `tsconfig.app.json` (step 3) |
| Components not found during `shadcn add` | Missing registry config | Add `registries` with `@openpkg-ts` key to `components.json` (step 5) |
| `dk-*` classes have no effect | Tailwind v4 doesn't scan `node_modules` | Add `@source "../node_modules/@openpkg-ts/ui/dist/docskit"` (step 7) |
| Selection highlight missing in code blocks | Tailwind can't auto-generate `selection:` variant for custom colors | Included in `docskit.css` import (step 7) |
| Components render light but app is dark (or vice versa) | Components follow `--openpkg-*` tokens which respond to `.dark` class / `prefers-color-scheme` | Add `class="dark"` to `<html>` or use system preference (step 8) |
