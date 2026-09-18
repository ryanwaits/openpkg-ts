---
"@openpkg-ts/sdk": patch
---

Resolve external package names from the last `node_modules` segment. On pnpm and bun store layouts, stubs reported `.pnpm` as their origin and `followExternal: ['zod']` never matched.
