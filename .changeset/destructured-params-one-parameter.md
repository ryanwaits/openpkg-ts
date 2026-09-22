---
"@openpkg-ts/sdk": minor
"@openpkg-ts/spec": patch
---

A destructured parameter (`({ model, value }: Options)` or `([a, b]: T)`) is emitted as ONE parameter instead of one positional parameter per key. It is named `options` (object pattern) or `args` (array pattern), or after the `@param` tag that documents it; `schema` is the declared type keyed by the public property names, never the local renames (an inline literal or a `$ref` to a named type stays as written; an intersection, union of objects or mapped/conditional type is resolved to `type: object` with `properties`/`required` from the checker and the written form under `x-ts-type`); `required` follows the pattern's own `?` or `= {}`; and it carries `"x-ts-destructured": true`. Key defaults (`{ mode = 'dev' }`) and `@param name.key` descriptions land on the matching property schemas. Function-typed properties no longer leak the checker's `__0` name. Signature text prints optional object keys with `?` (`{ model: M; modelId?: string }`).
