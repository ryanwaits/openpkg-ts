# openpkg.dev

Static site for the OpenPkg standard. No build step.

- `index.html` — the OpenPkg Specification (v0.4.0), single self-contained page
- `schemas/v*/openpkg.schema.json` — canonical hosted JSON Schemas (targets of every document's `$schema` / schema `$id`)
- `vercel.json` — CORS + content-type headers for `/schemas/*`

## Sync schemas

Canonical source of the schema files is `packages/spec/schemas/`. After changing them:

```sh
bun run site:sync-schemas
```

## Deploy

```sh
vercel site/ --prod
```

Point `openpkg.dev` at the Vercel project. The spec page is the root; schemas resolve at `https://openpkg.dev/schemas/v0.4.0/openpkg.schema.json`.
