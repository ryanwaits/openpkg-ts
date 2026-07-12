---
"@openpkg-ts/spec": minor
---

Canonical `$schema` URL moves to `https://openpkg.dev/schemas/v{version}/openpkg.schema.json`, decoupling the OpenPkg standard from the TypeScript packaging. `SCHEMA_URL` now points at openpkg.dev; the unpkg URL remains available as the new `SCHEMA_URL_MIRROR` export. Schema `$id` fields updated for all published versions (v0.1.0–v0.4.0).
