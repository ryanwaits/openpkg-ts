---
"@openpkg-ts/sdk": patch
---

Stop emitting path-named types for `export * as Ns from './file'` namespaces (the spec leaked absolute local paths and differed per machine). `--jev` package pick can now abstain on peer-library monorepos instead of acting on a near-threshold guess.
