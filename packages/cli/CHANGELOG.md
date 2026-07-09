# @openpkg-ts/cli

## 0.7.0

### Minor Changes

- 6a468e0: Rebuild CLI as a thin wrapper over @openpkg-ts/sdk. Commands: spec (extract OpenPkg spec), docs (markdown/HTML/JSON), list (exports), diff (semver recommendation, exit 2 on breaking). Replaces the broken 0.6.x line, which depended on the never-published @openpkg-ts/registry and could not be installed.
