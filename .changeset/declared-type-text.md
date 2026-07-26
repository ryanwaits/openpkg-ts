---
"@openpkg-ts/spec": minor
"@openpkg-ts/sdk": minor
---

Add `x-ts-declared`: the type as the author wrote it, alongside the resolved
`x-ts-type`.

`x-ts-type` carries the resolved truth, which a validator or codegen wants but a
docs reader often does not recognize: `type WithoutKind<T> = Omit<T, 'kind'>`
resolves to `{ [P in Exclude<keyof T, "kind">]: T[P]; }`, and a property typed
`InitiatorType` resolves to its full literal union. `x-ts-declared` now carries
`Omit<T, 'kind'>` and `InitiatorType` respectively, so a docs consumer can show
the declared form without re-parsing source.

Scoped to keep it signal, not noise:

- **Divergence only.** Emitted solely when the declared form differs from the
  resolved `x-ts-type`, so the common case (declared == resolved) is unchanged.
- **Named forms only.** Restricted to type references and unions — the shapes
  where the author wrote a name that resolves to something else. Object literals,
  mapped, and conditional bodies are excluded, since they differ from their
  resolved text only by formatting (a trailing `;`) or would drag source
  comments into the spec.
- **Never affects member extraction.** Object properties stay resolved; this is
  purely an additional rendered-text field.

The meta-schema declares `x-ts-declared`. Known minor case left for a follow-up:
`ReadonlyArray<T>` vs the resolved `readonly T[]` still diverges as a notation
equivalent; both are faithful, so it is emitted rather than normalized away.
