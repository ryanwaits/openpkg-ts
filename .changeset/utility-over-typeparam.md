---
"@openpkg-ts/sdk": patch
---

Keep lib utilities over type params as written `x-ts-type` (`Readonly<T>`), not an expanded empty object. Named generic refs stay `$ref` + `x-ts-type-arguments` (ReadonlyMap). `readonly T[]` gets `x-ts-readonly: true`.
