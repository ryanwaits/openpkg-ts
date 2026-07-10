# @openpkg-ts/cli

## 0.8.2

### Patch Changes

- Updated dependencies [f9e2049]
  - @openpkg-ts/sdk@0.40.0

## 0.8.1

### Patch Changes

- Updated dependencies
  - @openpkg-ts/sdk@0.39.0

## 0.8.0

### Minor Changes

- 623d86b: Ship the generate-docs agent skill in the npm tarball (skills/generate-docs/SKILL.md). Copy it into your project's .claude/skills/ to let an agent scaffold framework-ready API reference docs (Fumadocs, Docusaurus, plain Markdown) with navigation, search indexes, and output verification.

### Patch Changes

- Updated dependencies [623d86b]
- Updated dependencies [3dc6c72]
  - @openpkg-ts/sdk@0.38.0

## 0.7.0

### Minor Changes

- 6a468e0: Rebuild CLI as a thin wrapper over @openpkg-ts/sdk. Commands: spec (extract OpenPkg spec), docs (markdown/HTML/JSON), list (exports), diff (semver recommendation, exit 2 on breaking). Replaces the broken 0.6.x line, which depended on the never-published @openpkg-ts/registry and could not be installed.
