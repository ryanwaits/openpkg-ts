---
"@openpkg-ts/sdk": patch
---

Treat a symbol as a platform global when any of its declarations is a bundled lib file, not just the first. Globals such as `AbortSignal` are declared by lib.dom and again by `bun-types` / `@types/node`; reading only the first declaration made a stub's origin depend on TypeScript's declaration order.
