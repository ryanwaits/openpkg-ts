---
"@openpkg-ts/sdk": patch
---

`export default <expression>` is extracted instead of skipped as `default: internal`: `export default (a: number) => a` and function expressions (through parentheses, `as`, `satisfies`) are `kind: "function"` with signatures; object literals, primitives and call expressions (`export default defineConfig({...})`) are a `variable` typed by the checker, or a `function` / `class` when that type is callable / constructable. `name` is `"default"`, there is no `localName`, and docs come from the export statement.
