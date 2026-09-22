---
"@openpkg-ts/sdk": patch
---

A destructured parameter typed as a discriminated union keeps its per-arm requiredness: beside the merged `properties` and the shared `required`, the schema carries `anyOf: [{ required: [...] }, ...]`, each arm listing only the keys it requires beyond the shared ones (`generateText`: `required: ["model"]`, `anyOf: [{ required: ["prompt"] }, { required: ["messages"] }]`). The `anyOf` is omitted when it would not bind (an arm requires nothing more, or every arm agrees). A key typed `never` in the arm that omits it (`messages?: never`) takes its type from the arm that has it (`ModelMessage[]`), no longer `undefined`.

A property merged across conditional-type branches (`C extends true ? { ctx?: never } : { ctx: Ctx<T> }`, undecided for a generic `T`) is no longer asserted as `never`: the branch that types it supplies the written text (`x-ts-type: "InferToolSetContext<TOOLS>"`), and disagreeing branches yield to the checker's type. A destructured parameter on the AST fallback path (a conditional alias written directly on the parameter) is named `options` / `args` with `x-ts-destructured`, not by its source text. `formatSchema` renders an object with a required-only `anyOf` as the object.
