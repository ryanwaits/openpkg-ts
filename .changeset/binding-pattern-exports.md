---
"@openpkg-ts/sdk": patch
---

Export names bound by destructuring (`const [cache, mutate, , , unload] = init(); export { mutate }`, object patterns with renames, defaults, nesting and rest). Each binding is typed by the checker and classified like any variable (swr: `mutate`, `unload` were missing).
