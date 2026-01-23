# test-extraction

Test the `openpkg` CLI extraction accuracy against real TypeScript repositories.

## Arguments

$ARGUMENTS - Space-separated list of GitHub repo URLs to test against

## DO NOT

- **DO NOT** audit the target repositories for bugs, security issues, or code quality
- **DO NOT** analyze the target codebase architecture or patterns
- **DO NOT** suggest improvements to the target repos
- **DO NOT** run any commands other than `openpkg` CLI commands

You are testing OUR tool (`openpkg`), not evaluating THEIR code.

## What This Command Does

1. Clones target repos as test fixtures
2. Runs `openpkg` CLI commands against them
3. Verifies CLI output accuracy by comparing extracted data to actual source code
4. Reports any extraction bugs, missing data, or incorrect output from `openpkg`

## Step 1: Verify CLI

```bash
openpkg --version
```

Confirm version is installed and note it for the report.

## Step 2: Clone Repos

For each repo URL in arguments, clone to `/tmp`:

```bash
cd /tmp && gh repo clone <repo-url> <repo-name>-fixture -- --depth 1
```

Use `gh repo clone` for GitHub URLs. Suffix with `-fixture` to clarify these are test fixtures.

## Step 3: Spawn Parallel Subagents

For each cloned repo, spawn a subagent. For monorepos, spawn additional subagents for key packages.

**Subagent prompt:**

```
You are testing the `openpkg` CLI extraction accuracy against <REPO_NAME>.

Location: /tmp/<REPO_DIR>-fixture

## IMPORTANT: You are NOT auditing this codebase

Do not look for bugs, security issues, or code quality problems in the target repo.
Your only job is to verify that `openpkg` correctly extracts API information.

## Commands to Run

1. Find entry point:
   - Look for src/index.ts, lib/index.ts, or check package.json "main"/"exports"
   - For .d.ts-only packages, use the declaration file

2. Generate spec:
   openpkg snapshot <entry-point> -o /tmp/<name>-spec.json

3. Validate spec:
   openpkg validate /tmp/<name>-spec.json

4. Run diagnostics:
   openpkg diagnostics /tmp/<name>-spec.json

5. Test filters (run all):
   openpkg filter /tmp/<name>-spec.json --kind function --summary
   openpkg filter /tmp/<name>-spec.json --kind type --summary
   openpkg filter /tmp/<name>-spec.json --kind interface --summary
   openpkg filter /tmp/<name>-spec.json --kind class --summary
   openpkg filter /tmp/<name>-spec.json --kind variable --summary
   openpkg filter /tmp/<name>-spec.json --deprecated --summary
   openpkg filter /tmp/<name>-spec.json --has-description --summary
   openkpg filter /tmp/<name>-spec.json --missing-description --summary

6. Generate docs:
   openpkg docs /tmp/<name>-spec.json -f md -o /tmp/<name>-docs.md

7. Self-diff (expect empty/no changes):
   openpkg diff /tmp/<name>-spec.json /tmp/<name>-spec.json
   openpkg semver /tmp/<name>-spec.json /tmp/<name>-spec.json
   openpkg changelog /tmp/<name>-spec.json /tmp/<name>-spec.json

## Verification (CRITICAL)

After running commands, verify extraction accuracy:

1. Read /tmp/<name>-spec.json
2. Select 5-10 exports to verify (mix of functions, types, classes)
3. For EACH selected export:
   a. Note the `sourcePath` and `line` from the spec
   b. Read that exact file and line in the source repo
   c. Compare and verify:
      - Name matches
      - Kind (function/type/class/etc) correct
      - Signature matches source exactly
      - Parameter names and types correct
      - Optional params have `required: false`
      - Return type matches
      - JSDoc description captured (if present in source)
      - @deprecated tag captured (if present)
      - @example captured (if present)
      - Generic type parameters captured
      - Source line number is accurate (+/- 2 lines acceptable)

4. Check for MISSING exports:
   - Grep source for `export function`, `export class`, `export type`, `export interface`
   - Verify these appear in the spec
   - Note any public exports that openpkg missed

## Output Format

Write report to: /tmp/<package-name>-extraction-report.md

```markdown
# openpkg Extraction Test: <package-name>

## Test Environment
- openpkg version: X.X.X
- Target: <repo-url>
- Entry point: <path>
- Test date: <date>

## Command Results

| Command | Exit Code | Output Summary |
|---------|-----------|----------------|
| snapshot | 0/1 | X exports extracted |
| validate | 0/1 | valid/invalid + errors |
| diagnostics | 0/1 | X missing descriptions, Y deprecated no reason |
| filter --kind function | 0/1 | X matches |
| filter --kind type | 0/1 | X matches |
| docs | 0/1 | generated/failed |
| self-diff | 0/1 | empty/unexpected changes |

## Extraction Verification

| Export | Kind | Source Line | Sig Match | Types Match | JSDoc | Status |
|--------|------|-------------|-----------|-------------|-------|--------|
| foo | function | src/index.ts:42 | ✓ | ✓ | ✓ | PASS |
| Bar | class | src/bar.ts:10 | ✓ | ✗ wrong | - | FAIL |

## Missing Exports (if any)
- `exportName` at src/file.ts:XX - not in spec

## Extraction Bugs Found
- [ ] Bug description with specific details
- [ ] Another bug

## Summary
- Exports in spec: X
- Verified: Y
- Passed: Z
- Failed: W
- Missing: V
```

Return this report inline AND write to file.
```

## Step 4: Collect Results

Wait for all subagents. Compile summary:

| Repo | Package | Entry Point | Exports | Verified | Pass | Fail | Missing | Report Path |
|------|---------|-------------|---------|----------|------|------|---------|-------------|

## Step 5: Cleanup

After collecting all results:

```bash
rm -rf /tmp/*-fixture /tmp/*-spec.json /tmp/*-docs.md
```

Keep report files in `/tmp/*-extraction-report.md` for review.

## Step 6: Final Summary

Provide:
- Total packages tested
- Total exports extracted across all packages
- Verification pass rate
- List of extraction bugs found (grouped by bug type)
- Paths to all report files
