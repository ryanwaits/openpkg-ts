import { describe, expect, test } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { OpenPkg } from '@openpkg-ts/spec';
import { $ } from 'bun';

const oldSpec: OpenPkg = {
  meta: { name: 'test-pkg', version: '1.0.0' },
  exports: [
    { id: 'fn-greet', name: 'greet', kind: 'function', signatures: [] },
    { id: 'fn-removed', name: 'removed', kind: 'function', signatures: [] },
  ],
  types: [],
};

const newSpec: OpenPkg = {
  meta: { name: 'test-pkg', version: '2.0.0' },
  exports: [
    { id: 'fn-greet', name: 'greet', kind: 'function', signatures: [] },
    { id: 'fn-added', name: 'added', kind: 'function', signatures: [] },
  ],
  types: [],
};

describe('changelog command', () => {
  test('outputs JSON format', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'changelog-test-'));
    const oldPath = path.join(tmpDir, 'old.json');
    const newPath = path.join(tmpDir, 'new.json');

    fs.writeFileSync(oldPath, JSON.stringify(oldSpec));
    fs.writeFileSync(newPath, JSON.stringify(newSpec));

    const result =
      await $`bun packages/cli/bin/openpkg.ts changelog ${oldPath} ${newPath} --format json`.text();
    const parsed = JSON.parse(result);

    expect(parsed).toHaveProperty('breaking');
    expect(parsed).toHaveProperty('added');
    expect(parsed).toHaveProperty('removed');
    expect(parsed).toHaveProperty('summary');

    fs.rmSync(tmpDir, { recursive: true });
  });

  test('outputs markdown format', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'changelog-test-'));
    const oldPath = path.join(tmpDir, 'old.json');
    const newPath = path.join(tmpDir, 'new.json');

    fs.writeFileSync(oldPath, JSON.stringify(oldSpec));
    fs.writeFileSync(newPath, JSON.stringify(newSpec));

    const result = await $`bun packages/cli/bin/openpkg.ts changelog ${oldPath} ${newPath}`.text();

    expect(result).toContain('## Breaking Changes');
    expect(result).toContain('removed');
    expect(result).toContain('## Added');
    expect(result).toContain('added');

    fs.rmSync(tmpDir, { recursive: true });
  });

  test('empty diff shows no changes', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'changelog-test-'));
    const oldPath = path.join(tmpDir, 'old.json');
    const newPath = path.join(tmpDir, 'new.json');

    fs.writeFileSync(oldPath, JSON.stringify(oldSpec));
    fs.writeFileSync(newPath, JSON.stringify(oldSpec));

    const result = await $`bun packages/cli/bin/openpkg.ts changelog ${oldPath} ${newPath}`.text();

    expect(result.trim()).toBe('No changes detected.');

    fs.rmSync(tmpDir, { recursive: true });
  });
});
