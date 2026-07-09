---
"@openpkg-ts/sdk": patch
---

Type-level fixes, no runtime changes: ExportMetadata now correctly types tags/examples as SpecTag[]/SpecExample[]; getExportKind return type narrowed to the kinds it can actually produce; getUnionType internal-API call wrapped in a scoped typed cast; removed stale JSDoc pointing at the retired component registry. Zero tsc errors across the monorepo.
