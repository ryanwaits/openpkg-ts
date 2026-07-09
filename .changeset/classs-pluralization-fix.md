---
"@openpkg-ts/sdk": patch
---

Fix naive kind pluralization producing labels like "Classs" in markdown/HTML headings, HTML nav, and Algolia record hierarchy. All kind labels now come from KIND_LABELS in @openpkg-ts/spec (class → Classes, etc.). Also fixes nav group sorting, which de-pluralized titles naively and broke kind ordering for classes.
