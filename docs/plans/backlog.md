# OpenPkg Backlog

Deferred work from the Standard Schema compatibility round (spec/sdk/cli). Each
item is scoped but intentionally left for a later release. Ordered by priority.

## followExternal: match the import specifier, not just the declaring package

DONE (partial) in sdk 0.48.0 / cli 0.11.0 — external stubs now record the
declaring package as `x-ts-package`, the CLI prints "stubbed from: <pkg>" so
users know what to follow, and `followExternal` accepts globs (`@ai-sdk/*`).
Remaining (optional): also match the *import specifier* a type was reached
through, so `followExternal: ['ai']` expands types reachable via
`import ... from 'ai'` even when they're declared in `@ai-sdk/provider`. Lower
priority now that the declaring package is surfaced.

## toToolSchema v2 — class & variable exports

`toToolSchema` (in `packages/sdk/src/schema/tool-schema.ts`) currently handles
**function exports only** — it throws a `TypeError` for any other kind. Extend
it once v1 (functions) is published and verified against real providers
(OpenAI strict structured outputs, Anthropic tool `input_schema`).

Open design questions:
- **Class exports**: map the constructor signature to tool params? Or emit one
  tool per public method (`Client.search`, `Client.get`)? Constructor-as-params
  is the smaller step; method-per-tool is more useful for agent frameworks.
- **Variable / schema-object exports**: a `const config: Config` or an exported
  Zod/Valibot schema object. The object's own schema wraps trivially, but the
  "what are the params" framing doesn't apply — likely just `toJsonSchema` of
  the export, no wrapper.

Do NOT start until v1 function support is on npm and validated end-to-end.

## Remove dead `resolveExternalTypes` option

`ExtractOptions.resolveExternalTypes` (`packages/sdk/src/types.ts`) is stored on
the serializer context (`context.ts`) but consumed nowhere — it was superseded
by the `followExternal` predicate + external-stub behavior added in this round.
Remove the option and its context field; check for external callers first.

## Rest-element tuple `maxItems`

Tuples with a rest element (`[string, ...number[]]`) get a wrong `maxItems`
from the builder — pre-existing, noted during the `prefixItems` rename. The
tuple emitter in `schema-builder.ts` pins `maxItems` to the element count even
when the last element is variadic. Should drop `maxItems` (or set it open) when
a rest element is present.

## Structured `@default` JSDoc capture (B1 stretch)

Regular parameter initializers now populate `default` (literals) or
`x-ts-default` (non-literals). Not yet captured: a `@default` JSDoc tag when no
initializer is present. If a `@default` tag exists and no initializer default
was found, JSON-parse the tag text into `default`, else `x-ts-default`.
See `packages/sdk/src/types/parameters.ts`.

## Conditional-alias union-of-branches lowering (B4 stretch)

Generic conditional aliases (`Cond<T> = T extends string ? 'a' : 'b'`) now bail
to `x-ts-type` verbatim text instead of exploding into prototype methods. A
richer lowering: when neither the true-branch nor false-branch references a type
parameter, emit `anyOf: [<trueType>, <falseType>]` instead of the text bail.
See the conditional gate in `packages/sdk/src/serializers/type-aliases.ts`.

## Structural-dedup for dual-resolution type collisions

The name-collision fix (collision-scoped type ids) correctly splits two genuinely
different same-named types. But a build that resolves ONE type through two
declaration files (e.g. a monorepo seeing a workspace package as both `src`
source and built `dist/*.d.ts`) produces two structurally-identical entries
(`Logger` + `pkg.Logger`) where one would do. Harmless (no member loss) and does
not occur for normal single-resolution `openpkg spec` runs (verified: zero
scoped ids on stacks/accounts, clarity, x402), but adds a redundant entry for
dual-resolution monorepos. A post-extraction pass could merge structurally
identical same-named types (keep one id, rewrite refs to the survivor). Requires
a ref-rewrite over exports[]+types[]; can reuse the ref-walker traversal.
