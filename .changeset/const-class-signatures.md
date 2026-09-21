---
"@openpkg-ts/sdk": patch
---

A value with construct signatures (`export const ZodString: core.$constructor<ZodString>`) carries them in `signatures[]` like a class carries its constructors (parameters, docs, `overloadIndex`, `typeParameters` of a generic `new`). zod: 81 of 81 classes have signatures, was 2. When such a value has no type of its own name (`ZodRealError: $constructor<ZodError>`), `members`, `extends` and `typeParameters` come from the type its first construct signature returns, unless that type is a lib or unfollowed external one. An interface merged onto a class (`class Foo {}` + `interface Foo { extra(): void }`) adds its members, own and inherited, to the class's `members[]`; the class keeps its own `extends` and type parameters. Past the expansion budget, the text of a parameter whose annotation is a type parameter of an instantiated generic names the argument (`$ZodStringDef`), not the parameter (`D`).
