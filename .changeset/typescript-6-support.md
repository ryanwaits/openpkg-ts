---
"@openpkg-ts/sdk": minor
---

Support TypeScript 6 at runtime: the `typescript` dependency range is now `^5.0.0 || ^6.0.0`. TypeScript 6 is the final release line that ships the JS compiler API this package is built on. CI now runs a 5.9/6.0 test matrix.

Ambient `@types` packages are now discovered and passed to the compiler explicitly when a project pins neither `types` nor `typeRoots`. TypeScript 6 stopped auto-including `node_modules/@types/*`, which caused globals such as `AbortSignal` to extract as empty schemas.

Extracted output can differ slightly for packages that re-export TypeScript's own compiler types, because those declaration files differ between the 5.x and 6.x releases.
