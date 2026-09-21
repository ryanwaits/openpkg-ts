---
"@openpkg-ts/sdk": patch
---

A value and an interface (or type literal alias) under one name (`export interface ZodString {…}` + `export const ZodString`) now carry the type's members in `members[]`, like a real class: own members of every merged interface declaration, then members inherited through `extends` as `SpecInheritedMember`. A constructor (`kind: "class"`) also takes the interface's `extends` and `typeParameters`; variables and functions gain `members` only. Filled after all other exports, so it spends only what is left of the expansion budget (zod: 80 of 81 classes have members, was 2; past the budget member schemas are `x-ts-type` text). Also: inherited members carry `flags.optional` and `deprecated`, `inheritedFrom` names the ancestor that declares the member instead of the nearest base, and optional interface methods (`run?(): void`) are no longer dropped.
