---
"@openpkg-ts/sdk": patch
---

A type alias that only references another named type (`type Msg = UIMessage<A, B>`, `type A = B`, or a conditional resolving to one) no longer repeats the target's properties as its own `members`. Its schema is `$ref: #/types/<Target>` with `x-ts-type-arguments`, in both `exports[]` and `types[]`. Object-literal, intersection, `Pick`/`Omit` and mapped aliases keep their members.
