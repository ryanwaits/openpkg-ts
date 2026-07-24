---
"@openpkg-ts/sdk": minor
---

Extract `members[]` for object-literal, mapped, and cross-package aliases.

Previously only intersection and mapped-node aliases got the JSDoc-rich
members layer; `type Options = {…}` and `type Chosen = Pick<Base, 'a'>`
silently dropped per-property descriptions, tags, and flags. Array/tuple
aliases and TS-lib builtins (`Promise`, `Date`) are excluded so prototype
methods never leak in as members. The intersection path is unchanged.
