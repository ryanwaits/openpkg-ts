---
"@openpkg-ts/sdk": minor
---

Extraction fidelity for wasm/proxy-style surfaces. Mapped/conditional type aliases (`{[K in keyof SDK]: ...}`) now flatten into `members[]` via the checker, with `@deprecated`/JSDoc recovered from conditional arm aliases (syntax walk — the checker erases alias identity on instantiation). Inline function-type aliases get real signatures instead of an opaque self-`$ref`. Default compilerOptions now include `strict: true` so `T | undefined` unions survive extraction when no tsconfig is present.
