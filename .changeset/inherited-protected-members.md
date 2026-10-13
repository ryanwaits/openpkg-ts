---
"@openpkg-ts/sdk": patch
---

Inherited `protected` class members follow `includePrivate` like a class's own members: left out by default, so a public subclass no longer exposes its base class's internals in `members` or `schema`.
