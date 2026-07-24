---
"@openpkg-ts/sdk": minor
---

Emit `x-ts-type` on signature-carrying members.

Members with `signatures[]` (interface/class methods, resolved alias method
members, inherited methods) previously had no renderable type text at any
level. They now carry a synthetic function schema —
`{ "x-ts-function": true, "x-ts-type": "(pace: number) => void" }` — chosen
over a member-level field so the text lives where all other type text lives
(the schema layer) and flows through the normalizer unchanged. Same renderer,
policy, and `import()` scrub as property schemas; `x-ts-method` still marks
method-syntax declarations independently. Flattened interface/class schema
properties generated from members mirror the text.
