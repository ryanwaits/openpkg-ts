---
"@openpkg-ts/spec": minor
"@openpkg-ts/sdk": minor
---

Add `inlineTags`: the inline TSDoc tags (`{@link}`, `{@label}`) found in a doc
comment, exposed as structured data alongside the text they came from.

Block tags were already structured — `@remarks` and `@example` arrive as
`tags: [{name, text}]`. Inline tags were not: they stayed embedded in whatever
prose contained them, so a consumer needed its own TSDoc parser to get at them.
`{@label Transport}` is metadata that happens to be written inline, and
recovering it meant regexing it out of a description; `{@link sendBatch}` is
genuinely part of the sentence, and rendering it as a cross-reference meant the
same regex again.

Every node that carries documentation now carries the inline tags found in its
own text: export, type, member, signature, parameter, block tag, and example.

```jsonc
"description": "Prefer {@link sendBatch} for more than one item. {@label Transport}",
"inlineTags": [
  { "name": "link",  "text": "sendBatch" },
  { "name": "label", "text": "Transport" }
]
```

Scoped to keep it additive and predictable:

- **Text is untouched.** The tags stay in the description, tag text, and example
  code exactly as before — stripping them would break anything already consuming
  those fields, and `{@link}` legitimately belongs in the sentence. Verified on
  the fixture: the spec is byte-identical with `inlineTags` removed.
- **Own text only.** A node's `inlineTags` come from its own text field, never
  aggregated from its children. An export's list is what its description
  contained; the `@remarks` tag keeps its own; the example keeps its own.
- **Omitted, not emptied.** Nodes whose docs contain no inline tags gain no
  field, so existing exact-equality assertions on tags and members still hold.
- **Any inline tag, not a whitelist.** TypeScript only parses the three `{@link}`
  forms; `{@label}` and friends never leave the comment text at all. The scan
  covers TSDoc's inline-tag grammar generally, so custom tags come through too.
  A backslash escapes the brace.

The meta-schema declares `inlineTags` on `export`, `typeDef`, `member`,
`signature`, `parameter`, `tag`, and `example` — the last two matter, since both
are `additionalProperties: false` and would otherwise have failed validation.
`normalize()` preserves it on tags and `diffSpec` treats it as documentation, so
an inline-tag-only change stays a non-breaking diff.

Also fixes a latent data loss on the namespace/re-export path, which flattened
doc comments by mapping over `.text`: a JSDocLink node's `.text` holds only what
follows the entity name, so `{@link Foo}` collapsed to an empty string and the
symbol name was dropped outright. It now uses TypeScript's own serializer.

**Left for a separate decision:** a side list is enough to *extract* metadata and
makes link rendering possible (a consumer can substitute by name), but it is not
enough to *render* prose with links substituted in place — that needs character
offsets or a structured rich-text representation of the doc comment, which is a
much larger commitment than a string plus a side list. A narrower middle option
also exists and is not implemented here: `{@link}` targets are resolvable by the
checker at parse time, so an inline tag could carry the export it resolves to
rather than just the name a consumer has to match itself.
