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
