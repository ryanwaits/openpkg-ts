import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { OpenPkg } from '@openpkg-ts/spec';
import { $ } from 'bun';

/**
 * E2E test for full release workflow:
 * old.json → new.json → breaking check → semver → changelog → docs (fumadocs)
 */
describe('release workflow e2e', () => {
  let tmpDir: string;
  let oldPath: string;
  let newPath: string;

  const oldSpec: OpenPkg = {
    openpkg: '0.4.0',
    meta: { name: 'test-pkg', version: '1.0.0' },
    exports: [
      {
        id: 'fn-greet',
        name: 'greet',
        kind: 'function',
        description: 'Greets a person',
        signatures: [
          {
            parameters: [
              { name: 'name', schema: { type: 'string' }, description: 'Person name' },
            ],
            returns: { schema: { type: 'string' }, description: 'Greeting message' },
          },
        ],
      },
      {
        id: 'fn-goodbye',
        name: 'goodbye',
        kind: 'function',
        description: 'Says goodbye',
        signatures: [],
      },
    ],
    types: [],
  };

  const newSpec: OpenPkg = {
    openpkg: '0.4.0',
    meta: { name: 'test-pkg', version: '2.0.0' },
    exports: [
      {
        id: 'fn-greet',
        name: 'greet',
        kind: 'function',
        description: 'Greets a person with optional message',
        signatures: [
          {
            parameters: [
              { name: 'name', schema: { type: 'string' }, description: 'Person name' },
              { name: 'message', schema: { type: 'string' }, description: 'Optional message' },
            ],
            returns: { schema: { type: 'string' }, description: 'Greeting message' },
          },
        ],
      },
      {
        id: 'fn-hello',
        name: 'hello',
        kind: 'function',
        description: 'New hello function',
        signatures: [],
      },
    ],
    types: [],
  };

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'release-workflow-test-'));
    oldPath = path.join(tmpDir, 'old.json');
    newPath = path.join(tmpDir, 'new.json');

    fs.writeFileSync(oldPath, JSON.stringify(oldSpec));
    fs.writeFileSync(newPath, JSON.stringify(newSpec));
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('detects breaking changes', async () => {
    const proc = Bun.spawn(['bun', 'packages/cli/bin/openpkg.ts', 'breaking', oldPath, newPath]);
    const stdout = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;

    const result = JSON.parse(stdout);

    // Should find breaking change: goodbye removed
    expect(result.count).toBeGreaterThan(0);
    expect(exitCode).toBe(1); // exits 1 when breaking changes found
  });

  it('recommends semver bump', async () => {
    const output = await $`bun packages/cli/bin/openpkg.ts semver ${oldPath} ${newPath}`.text();
    const result = JSON.parse(output);

    expect(result.bump).toBe('major'); // breaking change = major
    expect(result.reason).toBeDefined();
  });

  it('generates changelog', async () => {
    const output = await $`bun packages/cli/bin/openpkg.ts changelog ${oldPath} ${newPath} --format json`.text();
    const result = JSON.parse(output);

    expect(result.breaking).toBeDefined();
    expect(result.added).toBeDefined();
    expect(result.removed).toBeDefined();
    expect(result.summary).toBeDefined();

    // Verify removed function detected (removed has full objects)
    const removed = result.removed.find((r: { name: string }) => r.name === 'goodbye');
    expect(removed).toBeDefined();

    // Verify added function detected (added is array of IDs)
    expect(result.added).toContain('fn-hello');
  });

  it('generates markdown docs', async () => {
    const output = await $`bun packages/cli/bin/openpkg.ts docs ${newPath}`.text();

    expect(output).toContain('greet');
    expect(output).toContain('hello');
    expect(output).toContain('Greets a person');
  });

  it('generates json docs', async () => {
    const output = await $`bun packages/cli/bin/openpkg.ts docs ${newPath} --format json`.text();
    const result = JSON.parse(output);

    expect(result.name).toBe('test-pkg');
    expect(result.exports).toBeDefined();
    expect(result.exports.length).toBe(2);
  });

  it('generates fumadocs output', async () => {
    const docsDir = path.join(tmpDir, 'fumadocs-output');

    await $`bun packages/cli/bin/openpkg.ts docs ${newPath} --adapter fumadocs --output ${docsDir}`;

    // Verify directory created
    expect(fs.existsSync(docsDir)).toBe(true);

    // Verify markdown files created (one per export)
    const files = fs.readdirSync(docsDir);
    const mdFiles = files.filter((f) => f.endsWith('.md'));
    expect(mdFiles.length).toBe(2); // greet.md, hello.md
  });

  it('validates new spec', async () => {
    const output = await $`bun packages/cli/bin/openpkg.ts validate ${newPath}`.text();
    const result = JSON.parse(output);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('runs diagnostics on new spec', async () => {
    const output = await $`bun packages/cli/bin/openpkg.ts diagnostics ${newPath}`.text();
    const result = JSON.parse(output);

    expect(result.summary).toBeDefined();
    expect(result.diagnostics).toBeDefined();
  });

  it('full workflow runs without error', async () => {
    // Simulate complete release workflow sequence
    const steps = [
      $`bun packages/cli/bin/openpkg.ts validate ${oldPath}`,
      $`bun packages/cli/bin/openpkg.ts validate ${newPath}`,
      $`bun packages/cli/bin/openpkg.ts semver ${oldPath} ${newPath}`,
      $`bun packages/cli/bin/openpkg.ts changelog ${oldPath} ${newPath} --format json`,
      $`bun packages/cli/bin/openpkg.ts diagnostics ${newPath}`,
      $`bun packages/cli/bin/openpkg.ts docs ${newPath} --format json`,
    ];

    for (const step of steps) {
      const output = await step.text();
      expect(() => JSON.parse(output)).not.toThrow();
    }
  });
});
