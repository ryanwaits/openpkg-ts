---
"@openpkg-ts/sdk": patch
---

A signature type written as a generic union or intersection alias keeps that reference instead of inlining the alias body: zustand `redux` returns `{ $ref: "#/types/StateCreator", "x-ts-type-arguments": [...] }`, not the expanded `((setState, getState, store) => ...) & { $$storeMutators? }`. Generic object and function aliases and interfaces already did this. The alias stays in `types[]`, decomposed at its own declaration only. A type argument that degrades to text reads as written (`Mutate<StoreApi<T>, Mos>`), not as its alias body. Anonymous structural types still expand inline.

A generic type is registered from its declaration, never from the instantiation that reached it first: `types[].Box` has `value: T`, was `value: string` when `Box<string>` came first. The entry no longer depends on export order or `only`.

A lib utility over a generic object with known keys flattens like a concrete one: `Partial<Options<D>>` lists `Options`' keys (SWR's `SWRConfiguration` now exposes `revalidateOnFocus` and the rest). A bare `Partial<T>` stays `x-ts-type` text.
