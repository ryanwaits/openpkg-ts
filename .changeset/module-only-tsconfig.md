---
"@openpkg-ts/sdk": patch
---

Stop forcing NodeNext `moduleResolution` onto a tsconfig that sets `module` alone (e.g. `"ES6"`). The invalid mix broke extensionless relative imports, so anything imported through them extracted as `any` (immer's `setAutoFreeze = immer.setAutoFreeze.bind(immer)` and 8 siblings). They now extract as functions with the method's signatures and docs.
