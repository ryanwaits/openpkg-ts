# OpenPkg Naming & Comms Architecture

Locked 2026-07-12. Model: OpenTelemetry (language-neutral standard + per-language implementations), not OpenAPI.

## The tagline

> **OpenPkg is a machine-readable standard for describing package APIs. openpkg-ts is its TypeScript reference implementation.**

Every README, page, and announcement leads with this framing. Two sentences, two names, zero ambiguity.

## Three layers

| Layer | Name | What it is |
|---|---|---|
| Standard | **OpenPkg** | The spec + brand. Language-neutral. Owns the version ("OpenPkg 0.4.0") |
| Implementation | **openpkg-ts** | "The TypeScript reference implementation of OpenPkg" |
| Artifact | **an OpenPkg document** | The `openpkg.json` a tool produces. Always neutral |

Future implementations follow the pattern: `openpkg-py`, `openpkg-go`, `openpkg-rs`. The `-ts` suffix is the first member of a family, not a branding bug.

## Language rules

1. **"OpenPkg" unqualified always means the standard.** Never "install OpenPkg" (you install `@openpkg-ts/cli`); never "the OpenPkg SDK" (it's "the openpkg-ts SDK").
2. **openpkg-ts is the "reference implementation," not "the tool."** Signals the spec is the source of truth and spinoffs are welcome.
3. **Spec version and tool versions never share a sentence unqualified.** "OpenPkg 0.4.0" is the format; "sdk 0.39.0" is a tool. Combined: "extracts OpenPkg 0.4.0 documents."
4. **The artifact is always neutral.** A spec extracted by TS tooling is an OpenPkg document *for* a TypeScript package, never a "TypeScript spec."
5. **Marketing grammar: "OpenPkg for TypeScript."** `openpkg-ts` is the repo/scope spelling; "OpenPkg for TypeScript" is the human spelling.

## Domain

`openpkg.dev` belongs to the standard, not to openpkg-ts:

- Root = the spec document (see `site/`)
- `/schemas/v*/openpkg.schema.json` = canonical hosted JSON Schemas
- Implementation docs live under the standard (e.g. `/docs/typescript`), never at the root

## Canonical schema URL

Canonical: `https://openpkg.dev/schemas/v0.4.0/openpkg.schema.json` (decoupled 2026-07-12; schema `$id`s and `SCHEMA_URL` point here).
Mirror: `https://unpkg.com/@openpkg-ts/spec/schemas/v0.4.0/openpkg.schema.json` (`SCHEMA_URL_MIRROR`).

## npm namespace

- `@openpkg-ts/*` — current TS packages, unchanged.
- `@openpkg` org + bare `openpkg` name — unclaimed as of 2026-07-12; **claim both defensively** (requires Ryan's npm auth).
- Whenever a second language becomes real: consider `@openpkg/spec` for the neutral schema + types; SDK/CLI stay under `@openpkg-ts/*`. Don't rename before then.
