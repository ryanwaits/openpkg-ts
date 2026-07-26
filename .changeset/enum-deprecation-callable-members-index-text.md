---
"@openpkg-ts/sdk": minor
---

Three fidelity fixes found by replacing a doc pipeline's type extraction
end-to-end (membership and content, no fallback extractor).

- **Enum members keep `@deprecated`.** The enum serializer only read a member's
  description; it now also carries the member's tags and deprecation, so a
  deprecated enum value and its migration note survive (previously
  `Mode.Legacy` lost its `deprecated` flag, reason, and description).
- **Callable object types keep their members.** A callable type literal
  (`{ (input: string): boolean; label: string }`) emitted the signature but
  dropped its properties; `label` (with its description) now appears in
  `members[]` alongside the `x-ts-signatures`.
- **Index-signature aliases carry renderable text.** An index-signature-only
  alias (`type PropertyFilters = { [key: string]: string[] }`) had no named
  members and no `x-ts-type`, leaving a consumer to hand-build the notation from
  `additionalProperties`. The registry entry now carries
  `x-ts-type: "{ [key: string]: string[]; }"`.

Design note (not implemented, filed for discussion): the spec carries only the
RESOLVED form of a type, never the DECLARED one. For a docs reader,
`Omit<T, 'kind'>` and `InitiatorType` are more useful than their expansions,
while a validator/codegen wants the resolved form. A future `x-ts-declared`
field could carry the as-written text alongside the existing `x-ts-type`. This
only ever affects rendered text, never member extraction (object properties stay
resolved). It is a real fork worth deciding deliberately: cases like
`Omit<T, 'kind'>` and a 21-literal `InitiatorType` alias are strictly better
declared, but `'special' | string` is arguably better resolved (`string` is the
truth; the literal implies a constraint that does not exist, and the cleaner fix
is writing `'special' | (string & {})` in source, which openpkg already
preserves). The R4-3 change above is where such a field would naturally live.
