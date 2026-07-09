---
name: generate-docs
description: >
  Generate framework-ready API reference docs (Fumadocs, Docusaurus, or plain
  Markdown) for a TypeScript package using OpenPkg. Detects the target docs
  framework, extracts an OpenPkg spec, writes page-per-export MDX/MD with
  navigation (meta.json / sidebars) and optional search indexes, then verifies
  output. Use when the user asks to "generate API docs", "generate docs from
  my TypeScript exports", "add an API reference to my docs site", "scaffold
  fumadocs/docusaurus API pages", "create reference docs with openpkg", or
  runs "/generate-docs". Optional args: entry file, framework
  (fumadocs|docusaurus|markdown), output dir.
---

# Generate API Reference Docs (OpenPkg)

Orchestrate `@openpkg-ts/cli` and `@openpkg-ts/sdk` to produce API reference pages for the consumer's docs framework. You orchestrate; the SDK renders. Do NOT hand-write per-export markdown — always render via the SDK so regeneration stays deterministic.

## 0. Prerequisites

Check `package.json` `packageManager`; prefer bun, fall back to the project's manager. Ensure tooling is available:

```bash
bunx @openpkg-ts/cli --help   # thin CLI: spec, docs, list, diff
```

For the generation script you need the SDK as a dev dep in the consumer project:

```bash
bun add -d @openpkg-ts/sdk
```

## 1. Detect entry point

If not given, in order: `package.json` `exports["."]` (source, not dist — check `src/index.ts` first), `main`/`module` mapped back to `src/`, else `src/index.ts`. Confirm it resolves by listing exports:

```bash
bunx @openpkg-ts/cli list src/index.ts
```

If this errors, stop and fix the entry (missing tsconfig path aliases are the usual cause). Note the export count — verify against it in step 6.

## 2. Detect docs framework

If not given, inspect the repo (also check sibling `apps/docs` or `docs/` workspaces in monorepos):

| Signal | Framework |
|---|---|
| `fumadocs-core` / `fumadocs-ui` in deps; `content/docs/` dir; `source.config.ts` | fumadocs |
| `@docusaurus/core` in deps; `docusaurus.config.*`; `sidebars.*` | docusaurus |
| `nextra`, `vitepress`, `mintlify` (`docs.json`/`mint.json`) | markdown (plain .md/.mdx pages; wire nav per that framework's convention manually) |
| none of the above | markdown |

Tell the user what you detected before generating. If they just want a single reference file, the CLI alone suffices:

```bash
bunx @openpkg-ts/cli docs src/index.ts -f md -o docs/API.md
```

## 3. Extract the spec

Always materialize the spec as a committed file — it is the regeneration input and the `diff` baseline:

```bash
bunx @openpkg-ts/cli spec src/index.ts -o openpkg.json
```

Warnings from diagnostics are fine; errors mean the spec is incomplete — surface them.

## 4. Generate pages + navigation

Write a small script into the consumer repo (e.g. `scripts/generate-api-docs.ts`) so regeneration is one command. Adapt paths; keep the slugify identical everywhere — the SDK's nav/search default is `name.toLowerCase().replace(/[^a-z0-9]+/g, '-')`, and filenames MUST match it or nav links 404.

### Fumadocs

Layout (page-per-export, grouped by kind — small APIs can skip subdirs and use one flat dir):

```
content/docs/api/
  index.mdx          # package overview
  meta.json          # root: index + kind folders
  functions/ …       # one .mdx per export + meta.json per kind dir
  classes/ … interfaces/ … types/ … variables/ …
```

```ts
// scripts/generate-api-docs.ts
import fs from 'node:fs';
import path from 'node:path';
import { createDocs } from '@openpkg-ts/sdk';

const OUT = 'content/docs/api';
const slug = (n: string) => n.toLowerCase().replace(/[^a-z0-9]+/g, '-');
const KIND_DIRS: Record<string, string> = {
  function: 'functions', class: 'classes', interface: 'interfaces',
  type: 'types', enum: 'enums', variable: 'variables',
};

const docs = createDocs('./openpkg.json'); // throws on invalid spec
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

// index page
fs.writeFileSync(path.join(OUT, 'index.mdx'),
  `---\ntitle: ${docs.spec.meta.name}\ndescription: API reference\n---\n\n${docs.spec.meta.description ?? ''}\n`);

const grouped = docs.groupByKind();
const rootPages: string[] = ['index'];

for (const [kind, exps] of Object.entries(grouped)) {
  if (!exps.length) continue;
  const dir = KIND_DIRS[kind] ?? `${kind}s`;
  fs.mkdirSync(path.join(OUT, dir), { recursive: true });
  const sorted = [...exps].sort((a, b) => a.name.localeCompare(b.name));
  for (const exp of sorted) {
    const md = docs.toMarkdown({ export: exp.id, frontmatter: true, codeSignatures: true });
    fs.writeFileSync(path.join(OUT, dir, `${slug(exp.name)}.mdx`), md);
  }
  fs.writeFileSync(path.join(OUT, dir, 'meta.json'), JSON.stringify({
    title: dir[0].toUpperCase() + dir.slice(1),
    pages: sorted.map((e) => slug(e.name)),
    defaultOpen: false,
  }, null, 2));
  rootPages.push(`...${dir}`);
}

fs.writeFileSync(path.join(OUT, 'meta.json'), JSON.stringify({
  title: `${docs.spec.meta.name} API`, pages: rootPages, defaultOpen: true,
}, null, 2));
```

Run: `bun scripts/generate-api-docs.ts`. For a flat single-dir layout instead, write all pages into `OUT` and use `toFumadocsMetaJSON(docs.spec, { groupBy: 'kind' })` from the SDK for `meta.json` — but verify the rendered sidebar, since fumadocs meta grouping conventions vary by version.

### Docusaurus

Same script shape; write `.md` into `docs/api/<slug>.md` (no kind subdirs unless the site is large), then generate the sidebar:

```ts
import { createDocs, toDocusaurusSidebarJS } from '@openpkg-ts/sdk';
const docs = createDocs('./openpkg.json');
// pages: docs.toMarkdown({ export: exp.id, frontmatter: true, codeSignatures: true }) per export
fs.writeFileSync('sidebars.api.js', toDocusaurusSidebarJS(docs.spec, { basePath: 'api' }));
```

Do NOT overwrite the consumer's existing `sidebars.js` — write the API sidebar to its own file and merge/import it into their config (`apiSidebar: require('./sidebars.api.js')`). `basePath` must match the docs folder route.

### Plain Markdown (no framework)

```bash
bunx @openpkg-ts/cli docs src/index.ts -f md -o docs/API.md
```

or page-per-export into `docs/api/` with the script above (`.md` extension, skip meta files) plus a `docs/api/README.md` index linking each page.

## 5. Search indexes (optional — ask the user)

Only if the site has (or wants) search:

```ts
import { createDocs } from '@openpkg-ts/sdk';
const docs = createDocs('./openpkg.json');

// Pagefind (self-hosted search)
fs.writeFileSync('public/api-pagefind.json',
  JSON.stringify(docs.toPagefindRecords({ baseUrl: '/docs/api' }), null, 2));

// Algolia (upload via their API/CLI)
fs.writeFileSync('algolia-records.json',
  JSON.stringify(docs.toAlgoliaRecords({ baseUrl: '/docs/api' }), null, 2));

// Generic index (roll your own client-side search)
fs.writeFileSync('public/api-search.json',
  JSON.stringify(docs.toSearchIndex({ baseUrl: '/docs/api' }), null, 2));
```

`baseUrl` must match the deployed route prefix of the generated pages. Fumadocs and docusaurus both index rendered pages themselves by default — skip this step unless they're wiring an external index.

## 6. Verify

Run every check; report failures instead of declaring success:

1. **Coverage**: page count equals the export count from step 1 (`bunx @openpkg-ts/cli list src/index.ts --json` array length, minus intentionally filtered exports).
2. **Frontmatter**: spot-check 2-3 files — `---` block with `title:` present, first heading renders the export name, signature is inside a code fence.
3. **Nav ↔ files**: every slug in `meta.json` / `sidebars.api.js` has a matching file, and vice versa. A mismatch means slugify drift — fix the script, not the files.
4. **MDX compiles** (fumadocs/docusaurus): run the docs site build. Generic types like `Promise<T>` in prose can break MDX — if it fails, find the offending page, confirm `codeSignatures: true` was used, and escape or fence stray angle brackets.
5. **Links resolve**: check a couple of nav hrefs against the dev server — `basePath` mismatches are the common failure.

## 7. Leave it regenerable

- Commit `openpkg.json`, `scripts/generate-api-docs.ts`, and generated pages.
- Add to consumer `package.json`: `"docs:api": "openpkg spec src/index.ts -o openpkg.json && bun scripts/generate-api-docs.ts"`.
- On future API changes, semver guidance is one command: `bunx @openpkg-ts/cli diff openpkg.old.json openpkg.json` (exit code 2 = breaking).
- Warn the user that the generated dir is wiped on regeneration — hand-written docs belong outside it.

## Rules

- Never edit generated pages by hand to fix content — fix the source JSDoc and regenerate.
- Never overwrite user-owned config (`sidebars.js`, `source.config.ts`, `meta.json` outside the API dir); write alongside and show the merge.
- Ask before adding search indexes or deleting an existing docs dir.
- Keep all rendering in the SDK; if the SDK output is wrong, report it upstream rather than post-processing.
