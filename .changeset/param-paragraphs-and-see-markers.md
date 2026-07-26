---
"@openpkg-ts/sdk": minor
---

Stop losing text in the two places that reconstructed it instead of reading it.

**This one changes existing field values.** Rounds 5 and 6 could promise the
spec was byte-identical with the new field stripped; this cannot. `description`
on a parameter can widen from one line to several, which is visible to anything
rendering it in a table cell. That is the whole point of the fix, but it is a
behavior change rather than an addition.

**`@param` kept only its first paragraph.** TSDoc block tags run until the next
block tag, so everything up to `@returns` documents the parameter. The extractor
split on the first blank line and discarded the rest — silently, from every
field, including the reconstructed `tag.text`, which made `@param` the one tag
whose text had no home in the spec:

```ts
/**
 * @param mode - The mode.
 *
 *   Pass "fast" to skip validation. See {@link Other} for details.
 */
```

The second paragraph is now retained, and its `{@link Other}` shows up in the
parameter tag's `inlineTags` with no extra machinery — round 5's scanner reads
the text that was previously deleted before it got there.

The blank-line split itself was right about one thing, and that part is kept: a
*trailing paragraph made only of inline tags* is a whole-comment annotation, not
parameter documentation. Round 6 already computed exactly that split, so the two
rounds now share one rule — a trailing tag-only paragraph is the comment's,
everything else is the tag's. Comment-level tags are unchanged by this release.

**`@see` leaked raw JSDoc line markers.** Every continuation line of a
multi-line `@see` arrived with a literal `*` in it, where the same prose under
`@remarks` came out clean:

```
@remarks A guide,   ->  "A guide,\nwhich covers retries."
@see     A guide,   ->  "A guide,\n * which covers retries."   (before)
```

One marker per line is now stripped, anchored to horizontal whitespace so blank
lines survive and a markdown bullet or `*emphasis*` at line start is not eaten.

`@see` still reads source text rather than TypeScript's flattened comment, and
that is deliberate — TypeScript treats whatever follows `@see` as a link target
and drops it. On 5.9.3, `@see https://example.com/docs` flattens to
`://example.com/docs`, and `@see The guide` flattens to `guide`. Both are now
covered by regression tests, so the reconstruction is not "simplified away"
later.
