---
"@openpkg-ts/spec": minor
"@openpkg-ts/sdk": minor
---

Record method-syntax declaration form on members.

- **sdk**: members declared with method syntax (`run(cmd: string): void`) now
  carry `flags.methodSyntax: true`; function-typed properties
  (`walk: () => void`) do not. For resolved alias members the flag comes from
  `SymbolFlags.Method` on the post-mapping symbol — Omit/Pick-mapped members
  lose it, method-syntax re-declarations keep it — preserving the checker
  distinction doc pipelines filter on. Mirrored as `x-ts-method: true` on
  schema-layer function-valued properties. Resolved alias members also gain
  `flags.optional` and `flags.readonly` for parity with interface members.
- **spec**: new optional `x-ts-method` JSON Schema extension documented on
  `JSONSchemaExtensions` (additive).
