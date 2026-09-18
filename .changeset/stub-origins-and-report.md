---
"@openpkg-ts/sdk": patch
"@openpkg-ts/cli": patch
---

Stubbed types from the `typescript` package now record `x-ts-package: "typescript"` and expand when named in `followExternal`; only the bundled platform libs (lib.dom / lib.es) are excluded, not the whole package. The CLI's stubbed-externals report lists followable packages only: platform globals no longer appear as "(unknown origin)" under a hint that could never apply to them.
