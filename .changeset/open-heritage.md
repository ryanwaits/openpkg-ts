---
"@openpkg-ts/sdk": patch
---

A `types[]` entry for an interface or class records `extends` whenever the source has a heritage clause (the resolved base name, else the name as written; several bases joined with ` & `, the shape exports already use). When a base is something the checker cannot see into (`any`: an unresolved import, an alias over a missing global such as zustand's `type Config = Parameters<(typeof window)['__REDUX_DEVTOOLS_EXTENSION__']['connect']>[1]`), the schema no longer reads as a closed object: both the `types[]` entry and the export emit `allOf: [own shape, { $ref: "#/types/Config" }]`, the form an alias intersection with the same arm (`{...} & Config`) already takes. A base that is a value import from an unresolved module has no type to register, so its arm is `{ "x-ts-type": "ExtClass" }`. Resolvable bases are unchanged: flattened into the shape, closed.
