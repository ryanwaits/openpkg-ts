---
"@openpkg-ts/sdk": patch
---

Constructor signatures keep JSDoc `tags` and `examples` (`@param`, `@remarks`, `@example`) instead of dropping everything but the description — matching method signature serialization.
