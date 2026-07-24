---
"@openpkg-ts/spec": minor
"@openpkg-ts/sdk": minor
---

Surface inherited constructor signatures on subclasses that declare none of their own.

- **sdk**: when a class has no own constructor, construct signatures are resolved
  through the type checker — so base-class constructors (same file or sibling
  workspace package) appear on the subclass export with full JSDoc (description,
  param docs, tags, examples). Overloaded base constructors all serialize with
  `overloadIndex`. Default synthesized constructors (no declaration anywhere in
  the chain) still emit no signatures.
- **spec**: new optional `SpecSignature.inheritedFrom` field marks which base
  class declared the signature. Added to the v0.4.0 JSON schema along with the
  previously undocumented signature `tags`/`examples` fields (additive).
