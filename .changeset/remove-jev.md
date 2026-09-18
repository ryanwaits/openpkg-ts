---
"@openpkg-ts/sdk": minor
"@openpkg-ts/cli": minor
---

Remove Jev. Extraction and target resolution are deterministic-only again: dropped `decisions`, `evaluate`, `followExternal: 'auto'`, the `unavailable` resolve result, the `EvaluateFn`/`EvaluateRequest`/`EvaluateResult`/`JEV_CONFIDENCE`/`JEV_MODEL` exports, the optional `ai` peer dependency, and the CLI's `--jev` flag and `.env` loading. Ambiguous monorepos return the candidate list; pass a path or intent word (`openpkg spec . sdk`).
