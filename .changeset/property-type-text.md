---
"@openpkg-ts/sdk": minor
---

Emit `x-ts-type` (checker-rendered type text) on member, property, and alias schemas.

- Every property schema — both `members[].schema` and registry
  `schema.properties` — now carries the developer-facing type text rendered at
  the owning declaration with `NoTruncation` (`"Handler | Handler[]"`,
  `"boolean | Config"`, `"(c: Config) => void"`, `"\"auto\" | \"manual\""`).
  Omitted only when trivially derivable: bare primitive keywords and `$ref`s
  whose target name equals the text. Optional properties render without
  `| undefined`.
- Alias-level `x-ts-type` for array, instantiation, union, intersection, and
  function aliases (`"Item[]"`, `"Holder<string, Item>"`).
- `import("<abs path>").` qualifiers are scrubbed from all rendered text —
  machine-specific paths never land in a published spec.
- `readonly` members now surface at the schema layer as JSON Schema
  `readOnly: true` (previously member-layer `flags.readonly` only).
- Array aliases (`type L = Item[]`) get a real `{type: "array", items}`
  registry schema instead of an empty object.
- The normalizer preserves `x-*` extensions and `readOnly` across all branches
  (combinators, objects, arrays, refs).
