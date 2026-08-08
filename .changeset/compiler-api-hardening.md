---
"@openpkg-ts/sdk": patch
---

Replace removed and internal TypeScript compiler APIs with public equivalents. Default compiler options (used only when no tsconfig is found) now use NodeNext module and resolution instead of the CommonJS and node10 pair, which TypeScript 7 removes. The polymorphic `this` type is detected via public API instead of an internal type flag. Numeric type-flag literals are replaced with the named `TypeFlags` and `ObjectFlags` enums. No intended change to extracted output.

Note for packages with no tsconfig anywhere up-tree that set `"type": "module"` and use extensionless relative imports: NodeNext resolution does not resolve those specifiers, so affected exports are omitted from the spec. They are reported in the extraction result under `verification.skipped`. Adding explicit `.js` extensions to relative imports resolves it.
