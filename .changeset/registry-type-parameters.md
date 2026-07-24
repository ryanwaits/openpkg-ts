---
"@openpkg-ts/spec": minor
"@openpkg-ts/sdk": minor
---

Preserve `typeParameters` on registry entries.

- **sdk**: registry entries for generic aliases, interfaces, and classes now
  carry `typeParameters` (names, constraints, defaults, variance) the same way
  exports do — consumers can tell a generic alias (which cannot be flattened
  without its arguments) from a concrete one.
- **spec**: `SpecType.typeParameters?: SpecTypeParameter[]` added (additive).
