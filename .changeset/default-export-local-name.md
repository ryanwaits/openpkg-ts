---
"@openpkg-ts/sdk": patch
"@openpkg-ts/spec": patch
---

New optional `SpecExport.localName`: the identifier a default export goes by in source (`useSWR` for `export default useSWR`); `name` stays `"default"`. It is the declaration's own name when it has one, else the identifier it is exported under; absent on named exports and anonymous defaults. `export default function () {}` and `export default class {}` are now extracted (as `default`) instead of skipped.
