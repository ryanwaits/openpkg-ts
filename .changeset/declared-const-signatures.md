---
"@openpkg-ts/sdk": patch
"@openpkg-ts/spec": patch
---

`export const f: T = (...args) => …` takes its signatures (and type parameters) from the written `T` when it is callable, not from the initializer. Rest parameters are emitted with `rest: true` and `required: false` everywhere parameters are serialized (they were `required: true` with no `rest`); `schema` is the declared array/tuple type, and `toToolSchema` no longer wraps it a second time.
