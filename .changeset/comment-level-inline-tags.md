---
"@openpkg-ts/sdk": patch
---

Fix inline tags written outside any block tag being dropped.

Round 5 covered inline tags in the summary, inside a block tag's text, in
examples, and on properties. It missed the position where a whole-comment
annotation naturally goes — on its own line between block tags, or trailing
after the last one:

```ts
/**
 * Initializes the client.
 *
 * @param options - Connection options.
 *
 * {@label Initialization}
 *
 * @returns The initialized client.
 */
```

Those were not merely unstructured, they were gone: no `inlineTags`, and no raw
`{@label` left in the output to recover them from. The same tag two lines
higher, in the summary, worked — a silent, position-dependent failure.

TSDoc has no syntax for "this belongs to the comment", so TypeScript attaches
that line to whichever block tag precedes it. The extractor then dropped it:
`stripParamSeparator` splits on the blank line and keeps only the first
paragraph, on the (correct) grounds that loose text after a blank line is not
part of the param. The judgment was already right; the content was discarded
instead of hoisted.

A trailing paragraph consisting solely of inline tags is now treated as an
annotation on the doc comment and surfaces in the export's or member's
`inlineTags`, after any tags from the summary.

Scoped against over-capture, which is the real risk here:

- **Trailing paragraphs only, never the sole one.** `@remarks {@link Other}` is
  that tag's content and stays on the tag.
- **Tag-only paragraphs only.** A paragraph with prose in it belongs to the
  block tag it follows and is left alone.
- **The block tag no longer claims what was hoisted.** A hoisted tag appears at
  comment level, not on the `@param` it happened to sit under — the spec should
  not assert a relationship the source does not have.
- **`@see` is untouched**, since it runs its own URL-preserving extraction.

Text fields are unchanged, so round 5's additive guarantee still holds: on the
fixture the spec is byte-identical with `inlineTags` removed, and a tag in the
summary line produces exactly the output it did in 0.50.0.

Known boundary, unchanged by this fix: a trailing paragraph that mixes prose
with an inline tag (`See {@link Other} for the rest.`) is still dropped from the
param description by the same separator strip. Hoisting it would over-capture —
it reads as the param's text — so recovering it is a question about that strip,
not about inline tags.
