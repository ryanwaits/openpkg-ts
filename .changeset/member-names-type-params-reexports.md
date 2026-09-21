---
"@openpkg-ts/sdk": patch
---

- A member whose name needs quotes (`"~standard"`) is named without them and listed once; the overriding declaration wins over the inherited one (zod `ZodType` had both `"~standard"` and `~standard`).
- A type parameter is never a `$ref` target, whatever it is named: SWR's `Error = any` parameter emitted `#/types/types.Error` with no entry, now `{ "x-ts-type": "Error" }`.
- A type imported from a module that does not resolve is referenced by its written name (`#/types/ReactNode`, was `#/types/unknown`) and always has a stub entry to resolve to.
- `import { Hono } from './hono'; export { Hono }` resolves through the import when the checker cannot (extensionless specifier in an ESM package): hono 21 of 21 exports, was 20 with `Hono` skipped as `no-declaration`.
