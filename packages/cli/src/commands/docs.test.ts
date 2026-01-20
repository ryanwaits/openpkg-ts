import { describe, expect, test } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { OpenPkg } from '@openpkg-ts/spec';
import { $ } from 'bun';

const testSpec: OpenPkg = {
  meta: { name: 'test-pkg', version: '1.0.0' },
  exports: [
    { id: 'fn-hello', name: 'hello', kind: 'function', signatures: [] },
    { id: 'fn-world', name: 'world', kind: 'function', signatures: [] },
  ],
  types: [],
};

describe('docs command --adapter', () => {
  test('--adapter fumadocs generates docs', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'docs-adapter-test-'));
    const specPath = path.join(tmpDir, 'spec.json');
    const outDir = path.join(tmpDir, 'out');

    fs.writeFileSync(specPath, JSON.stringify(testSpec));

    await $`bun packages/cli/bin/openpkg.ts docs ${specPath} --adapter fumadocs --output ${outDir}`.text();

    expect(fs.existsSync(outDir)).toBe(true);
    expect(fs.existsSync(path.join(outDir, 'hello.md'))).toBe(true);
    expect(fs.existsSync(path.join(outDir, 'world.md'))).toBe(true);

    fs.rmSync(tmpDir, { recursive: true });
  });

  test('--adapter raw falls through to default', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'docs-adapter-test-'));
    const specPath = path.join(tmpDir, 'spec.json');

    fs.writeFileSync(specPath, JSON.stringify(testSpec));

    const result = await $`bun packages/cli/bin/openpkg.ts docs ${specPath} --adapter raw`.text();

    expect(result).toContain('hello');

    fs.rmSync(tmpDir, { recursive: true });
  });

  test('--adapter unknown exits with error', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'docs-adapter-test-'));
    const specPath = path.join(tmpDir, 'spec.json');
    const outDir = path.join(tmpDir, 'out');

    fs.writeFileSync(specPath, JSON.stringify(testSpec));

    const result =
      await $`bun packages/cli/bin/openpkg.ts docs ${specPath} --adapter unknown --output ${outDir}`.nothrow();

    expect(result.exitCode).toBe(1);
    // Error is written to stderr as JSON
    const stderr = result.stderr.toString();
    expect(stderr).toContain('Failed to load adapter');

    fs.rmSync(tmpDir, { recursive: true });
  });
});
