---
"@openpkg-ts/sdk": patch
---

The schema expansion budget is per export and per registered type (10,000 steps each), not one 20,000-step pool spent in export order. An export comes out the same in a full run and under `only: [...]`; one that spends its budget degrades alone (its deep parts become `x-ts-type` text) and the `TYPE_EXPANSION_LIMIT` diagnostic names it. A 200,000-step ceiling for the whole extract stays as the guard against runaway. zod: 304 of 304 exports match an unlimited run, was 94; valibot 787 of 787, was 503.

Reachability and type registration walk a generic's declaration once instead of every instantiation's member graph (zod: the reachability pass went from +280 MB to +6 MB), which pays for most of the extra expansion: zod 3.5 s / 1.27 GB RSS (was 2.5 s / 1.14 GB with 69% of exports degraded), valibot 2.6 s / 0.81 GB (unchanged).

A class reached first through `typeof Foo` is registered by its instances, not by its constructor side (`{ prototype }`).
