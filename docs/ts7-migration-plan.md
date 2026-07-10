# TypeScript 7 Migration Plan

Date: 2026-07-10 · TS 7.0.2 GA'd 2026-07-08 · Status: **locked 2026-07-10** (approved by Ryan; work starts 2026-07-10, Phase 0 first)

## TL;DR

TS7 = native Go compiler (`tsgo`), old JS compiler API removed. New IPC-based API ships **inside** `typescript@7` under `typescript/unstable/{sync,async,ast,fs}` — officially unstable, stabilizes as "the 7.1 API" (~Oct–Nov 2026, 3–4mo cadence).

**Measured on this repo** (extract 186 exports of `@openpkg-ts/sdk`, shallow walk):

| | TS 5.9.3 in-process | TS 7.0.2 native |
|---|---|---|
| program+checker init | 978ms | 102ms (~10x) |
| export walk (~560 checker calls) | 73ms | 24ms sync-Node / 55ms async-Bun |
| **total** | **1055ms** | **132ms Node / 175ms Bun (6–8x)** |

Implied IPC round-trip ≈ 43µs (sync/Node) / ~100µs (async/Bun). Deep recursion (10⁴–10⁵ calls on big packages) would add 0.5–10s naïvely → **batch-first redesign required for hot paths**, batch overloads exist for exactly this.

Verdict: **hybrid dual-backend**. TS5/6 JS API stays default + Bun-sync + browser story; TS7 native backend lands as opt-in experimental, flips to default when 7.1 stabilizes the API. Do NOT wait idle like TypeDoc/ts-morph/api-extractor — our used surface is narrow (~40 APIs), verified ~90% present in `unstable/sync` typings, and we can be first in the doc-extraction category.

## Ground truth (verified 2026-07-10)

**Hands-on (probe scripts, scratchpad `ts7-probe/`):**
- `typescript@7.0.2` = npm `latest`. Main export = version stub only; `tsc` bin = Go binary via per-platform `optionalDependencies` (~heavier installs).
- `typescript/unstable/sync` model: `new API({cwd, fs?}) → api.updateSnapshot({openProjects:[tsconfig]}) → snapshot.getProjects()[0] → {program, checker, emitter}`. `api.parseConfigFile()` exists. Virtual FS via `unstable/fs` `createVirtualFileSystem` + callbacks (readFile/fileExists/directoryExists/getAccessibleEntries/realpath).
- Checker surface verified PRESENT in shipped `.d.ts` (contradicting web reporting): `getSymbolAtLocation` (+batch), `getExportsOfModule`, `getAliasedSymbol`, `getTypeOfSymbol` (+batch), `getTypeOfSymbolAtLocation`, `getDeclaredTypeOfSymbol`, `getTypeAtLocation` (+batch), `getPropertiesOfType`, `getPropertyOfType`, `getIndexInfosOfType`, `getSignaturesOfType(type, kind)`, `getSignatureFromDeclaration`, `getResolvedSignature`, `getReturnTypeOfSignature`, `typeToString`, `typeToTypeNode`, `isArrayType`, `isTupleType`, `isArrayLikeType`, `getTypeArguments`, `getBaseTypes`, `getConstraintOfTypeParameter`, `getBaseConstraintOfType`, `getConstantValue`, `resolveName(name, meaning, location?)`, `getJsDocTagsOfSymbol`, `getDocumentationCommentOfSymbol`, intrinsic getters (`getAnyType`…). Enums re-exported (`SymbolFlags`, `TypeFlags`, `ObjectFlags`, `SignatureKind`, `ModifierFlags`…).
- Type handles materialize `flags`, `objectFlags`, `aliasSymbol`/`aliasTypeArguments` (via `getAliasSymbol()`/`getAliasTypeArguments()`), `elementFlags`, `isThisType`, plus local predicates `isUnionType()/isIntersectionType()/isTupleType()/isConditionalType()/isTypeParameter()`… and `getTypes()` for union/intersection members — flag dispatch stays local, no round-trip.
- Symbol handles carry `name`, `flags` (SymbolFlags local!), `declarations: NodeHandle[]` (**`.resolve()` = extra round-trip per declaration**, SourceFileCache amortizes), `getMembers()/getExports()` (cached), `getJsDocTags(checker)`.
- AST: `typescript/unstable/ast` is a real JS AST (binary-decoded from server) — `node.forEachChild`, `getLineAndCharacterOfPosition`, `unstable/ast/is` guards, `unstable/ast/jsdoc.getJSDocTags`, scanner/visitor/factory. **Positions are UTF-8, not UTF-16.**
- **Bun: sync API crashes** (`stdout._handle.fd` — Node-internal). **Async API works under Bun** (measured above). Public `extract()` already async → async-ification is internal-only, not a public break.
- No compiler-host hooks: no `resolveModuleNames` override, no `getSourceFile` override. Resolution happens Go-side. Emulation path: virtual FS + synthesized tsconfig (`paths` for workspace redirect, in-memory entry via FS callback).

**Ecosystem (as of today):**
- Official: "7.0 does not ship with an API… new (and different) API expected in 7.1." API-dependent tools told to alias `typescript@npm:@typescript/typescript6` (6.0.2/6.0.3, final JS line, `tsc6`).
- TypeDoc: feature-freeze, port in progress (~500 errors from >1000), no timeline. ts-morph: TS6-only, maintainer pessimistic, no port. api-extractor: still bundles TS **5.9.3**. typescript-eslint: peer `<6.1.0`, "nothing we can do." Nobody in our category has shipped on TS7.
- Wire protocol unversioned — client JS + Go binary must be same release ⇒ TS7 backend requires **exact-pinned** `typescript`, kills loose `^` ranges for that lane.
- TS 6.0 (2026-03-23) = bridge: strict-by-default, `module: esnext`, deprecates node10 resolution/`baseUrl`; 7.0 removes them + `target: es5`, `--outFile`, amd/umd/system. `--stableTypeOrdering` (6.x flag) matches 7.0's mandatory deterministic type ordering.
- Behavior deltas (typescript-go CHANGES.md): UTF-8 positions, stable type ordering (union order in `typeToString` may differ), stricter JS/JSDoc (no constructor-function classes, `@type` assertions don't narrow), template-literal inference by code point.

## Our exposure

All compiler API usage lives in **sdk** (cli/spec: zero). Single program-construction seam: `packages/sdk/src/compiler/program.ts`. Checker/AST usage spread across `builder/`, `serializers/`, `types/`, `ast/` (~40 distinct APIs; full map in workflow output).

Blocking issues found (fix regardless of TS7):
1. `DEFAULT_COMPILER_OPTIONS` uses `moduleResolution: NodeJs` + `module: CommonJS` — deprecated TS6, **removed TS7**. → `nodenext` (or `bundler`+`esnext`).
2. One internal-API call: `checker.getUnionType()` in `types/parameters.ts` (strip `undefined` from optional unions) — gone in TS7. → filter at JSON-schema level post-build.
3. `Type.isThisType` internal read in `schema-builder.ts:457` — actually present on TS7 handles, but keep syntactic `ThisTypeNode` fallback for portability.
4. Hardcoded flag numerics in `schema/registry.ts` (524288/4/32768/65536) → named enums.
5. sdk runtime dep `"typescript": "^5.0.0"` — loose range already lets extraction semantics drift across minors; TS7 lane needs exact pin.

Non-issues: browser entry ships zero compiler code (verified in dist) — unaffected. No emit/transform/watch/LS usage.

## Performance honesty

The 10x headline applies to parse/bind/check (Go, multithreaded `--checkers`). Our pipeline:
- Program creation (scales with whole workspace — we push all tsconfig+project-ref fileNames as roots): **the real ~10x win**, dominates CLI wall time today (93% of the probe's 1055ms).
- Checker traversal: Go-side checking faster, but every call = IPC. Probe: still 1.3–3x faster shallow. Deep recursion unproven; batch overloads (`getTypeOfSymbol(symbols[])`, `getSymbolAtLocation(nodes[])`) are the designed mitigation.
- Our JS serialization/registry/fixpoint logic: **0% from TS7**. Fixpoint `resolveName`-over-all-files pass is O(refs×files) and each probe now costs IPC → redesign export-table-driven (faster on TS5 too).

Realistic end-to-end: **5–10x CLI extraction on real packages** (program-dominated), less on huge chatty types until batch pass done.

## Phases

### Phase 0 — hardening + free wins (now, ships this week, zero risk)
- [ ] Fix `DEFAULT_COMPILER_OPTIONS` → `moduleResolution: nodenext`, `module: nodenext` (keep `strict`). Fixture-regression the change.
- [ ] Remove `checker.getUnionType` internal call → post-build `anyOf` filter for `undefined`.
- [ ] Replace `isThisType` internal read w/ syntactic detection; replace numeric flags w/ named enums.
- [ ] Root devDependency lane: `"typescript-native": "npm:typescript@7.0.2"` → CI job `tsgo --noEmit` per package next to `tsc --noEmit` (our tsconfigs are ES2022/ESNext/bundler/strict — already 7-clean). ~10x faster typecheck in CI; early warning on 7.x semantics.
- [ ] Snapshot-diff audit: run fixture extraction under `tsc6 --stableTypeOrdering` semantics to surface union-order churn before users see it; decide if `diffSpecs` needs order-insensitive union compare.

### Phase 1 — TS6 runtime compat (1–2 weeks)
- [ ] Full test suite under `typescript@npm:@typescript/typescript6` (6.0.3). Fix fallout (type-ordering snapshots most likely).
- [ ] Widen sdk dep: `"typescript": "^5.0.0 || ^6.0.0"` (+ document typescript6-alias setup for users on TS7 toolchains). CI matrix: 5.9 / 6.0.
- [ ] Rationale: users' projects will increasingly be 6/7-shaped tsconfigs (no baseUrl, bundler/nodenext); our parser must handle them while extraction stays on the JS checker.

### Phase 2 — backend seam + async-ification (2–4 weeks, the architectural core)
- [ ] **Day-1 spike (before seam design):** depth-5 recursive walk over zod's exports on `unstable/async`, `collectTiming: true` — measure real IPC cost for our recursion shape (see Resolved position 1). Outcome sets batch-API priorities.
- [ ] Define `ExtractorBackend` port covering exactly our used surface (the usage map is the interface spec): program/config construction, checker ops, AST access, JSDoc. Shape it **batch-friendly and async** (`getPropertiesWithTypes(type) → [{symbol, type, flags}]`) so IPC amortization is possible; TS5/6 impl = trivial sync passthrough wrapped in resolved promises.
- [ ] Async-ify serializer internals (public API already async — internal-only change). Mechanical: `buildSchema*`, serializers, registry walks become async; keep sync fast-path via the TS5 backend to avoid promise overhead where measurable.
- [ ] Land behind no behavior change: TS5/6 backend default, all fixtures byte-identical.

### Phase 3 — experimental native backend, ships as `@openpkg-ts/native` (3–6 weeks, parallel after seam)
- [ ] New package `@openpkg-ts/native`: owns exact-pinned `typescript@7.x` + platform binaries; sdk stays light. sdk detects it at runtime (`extractSpec({ backend: 'native' })` errors with install hint if missing).
- [ ] `NativeBackend` on `typescript/unstable/async` (Bun-safe; sync channel unusable under Bun).
- [ ] Config/program mapping: prefer user tsconfig via `openProjects`; when none (or `content`/workspace redirects needed) synthesize tsconfig + serve via virtual FS callbacks: in-memory entry, workspace-package `paths` redirect (replaces `resolveModuleNames` patch), jsconfig fallback.
- [ ] Port serializers to backend port; batch hot paths (properties+types per object, exports enumeration, declarations prefetch). UTF-8→UTF-16 position conversion for `source.line` parity.
- [ ] Expose as `extractSpec({ backend: 'native' })` + `openpkg --native` + `OPENPKG_BACKEND=native`. Docs: experimental, exact TS pin, Node also supported (sync channel) for max perf.
- [ ] Differential CI: every fixture extracted by both backends, specs deep-compared (allowing documented deltas: union order, `x-ts-type` strings). Perf harness on real packages (zod, hono, drizzle) tracking init/walk/total.

### Phase 4 — 7.1 stabilization gate (~Q4 2026)
Decision gate when 7.1 ships its stable API: surface parity for our port? sync variant retained? Bun story? protocol versioning?
- Pass → move `NativeBackend` to stable API, flip default (`native` when `@openpkg-ts/native` present, JS fallback otherwise), announce the 5–10x, **and freeze the JS backend** (bugfix-only — see Resolved position 6).
- Fail → stay dual-backend, TS6 default; reassess 7.2.

### Explicit non-goals now
- No `typescript@7` as required runtime dep (breaks every consumer without the binary/API).
- No production default on `unstable/*` (wire-protocol lockstep + promised 7.1 changes).
- No browser-extraction promises (IPC/native makes it structurally worse; browser entry unaffected today).

## Resolved positions (locked 2026-07-10)

1. **IPC cost (was open Q1) — winnable; better positioned than the gap analysis feared.** Two reasons: (a) existing guardrails (`maxTypeDepth=5`, `maxProperties=100`, cycle guards, permanent `registeredTypes` set) already bound checker-call counts by design — the 10⁵-call nightmare is exactly what those caps prevent; (b) the API's client-side object registries cache symbol/type handles and `getMembers()`/`getExports()` results, so repeat visits are local. **Action: 1-day spike before any Phase 2 design** — extend the probe to a real depth-5 recursive walk over zod's exports with `collectTiming` on; that single number de-risks the plan. If ugly → batch overloads (`getTypeOfSymbol(symbols[])`) are the designed fix — hence `ExtractorBackend` is **batch-first from day one, not retrofit**.
2. **7.1 API delta (was Q2) — design to OUR shape, not theirs.** Reading: "new and different" means different from the old JS API; `unstable/*` is the same code Microsoft has evolved since native-preview and is what 7.1 stabilizes (medium-high confidence). Hedge costs nothing: the port interface is defined by our ~40-API usage map, so 7.1 churn lands in one adapter file, not the serializers. Watch `typescript@next` (7.1.0-dev currently still exposes only `unstable/*`).
3. **typescript6 EOL (was Q3) — the clock is syntax, not security patches.** A frozen TS6 checker extracts existing code fine for years; what breaks it is users adopting TS 7.1+/7.2+ language features the TS6 parser can't read (~mid-2027 at their cadence). JS backend as default is safe through the 7.1 gate; after the flip it degrades gracefully into legacy fallback. Don't overthink.
4. **Packaging — separate `@openpkg-ts/native` package** (keeps sdk install light; owns the exact-pinned `typescript@7` dep + platform binaries).
5. **`content` under virtual FS (was Q5) — synthesize the virtual entry inside the real `baseDir`** (serve e.g. `<baseDir>/__openpkg_entry__.ts` from the FS callback; everything else falls through to real FS — the callback protocol's `undefined` = "fall back" exists for exactly this). Relative imports + node_modules walks then just work. One fixture test proves it.
6. **JS-backend freeze policy — once native is default, the JS backend is frozen: bugfix-only, no new features land in both.** Dual-maintenance is where plans like this quietly die; the freeze is the mitigation. New extraction features target the native backend only from that point.

## References
- Announcement: devblogs.microsoft.com/typescript/announcing-typescript-7-0/ · TS6: …announcing-typescript-6-0/
- Behavior deltas: github.com/microsoft/typescript-go/blob/main/CHANGES.md
- API discussion: github.com/microsoft/typescript-go/discussions/455
- Ecosystem: TypeDoc #3098 · typescript-eslint #10940 · ts-morph #1621 · rushstack #5052
- VS Code migration: code.visualstudio.com/blogs/2026/06/26/iterating-faster-with-ts-7
- Probe scripts + timings: session scratchpad `ts7-probe/` (probe-ts5.ts, probe-ts7.ts, probe-ts7-async.ts)
