import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CLI = path.join(import.meta.dir, 'index.ts');
const FIXTURE = path.join(import.meta.dir, '..', 'test-fixtures', 'sample.ts');

async function run(args: string[]): Promise<{ stdout: string; stderr: string; code: number }> {
  const proc = Bun.spawn(['bun', CLI, ...args], { stdout: 'pipe', stderr: 'pipe' });
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { stdout, stderr, code };
}

describe('openpkg cli', () => {
  it('--help prints usage', async () => {
    const { stdout, code } = await run(['--help']);
    expect(code).toBe(0);
    expect(stdout).toContain('Usage:');
    expect(stdout).toContain('openpkg spec');
  });

  it('--version prints version', async () => {
    const { stdout, code } = await run(['--version']);
    expect(code).toBe(0);
    expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('spec extracts a valid spec', async () => {
    const { stdout, code } = await run(['spec', FIXTURE]);
    expect(code).toBe(0);
    const spec = JSON.parse(stdout);
    expect(spec.exports.map((e: { name: string }) => e.name).sort()).toEqual(['User', 'greet']);
  });

  it('docs renders markdown with proper plural headings', async () => {
    const { stdout, code } = await run(['docs', FIXTURE]);
    expect(code).toBe(0);
    expect(stdout).toContain('## Classes');
    expect(stdout).toContain('## Functions');
    expect(stdout).not.toContain('Classs');
  });

  it('list prints exports', async () => {
    const { stdout, code } = await run(['list', FIXTURE]);
    expect(code).toBe(0);
    expect(stdout).toContain('greet');
    expect(stdout).toContain('class');
  });

  it('unknown command fails with guidance', async () => {
    const { stderr, code } = await run(['bogus']);
    expect(code).toBe(1);
    expect(stderr).toContain('unknown command');
  });

  describe('export-less entry fails loudly', () => {
    let dir: string;
    let emptyEntry: string;

    beforeAll(() => {
      dir = fs.mkdtempSync(path.join(os.tmpdir(), 'openpkg-cli-empty-'));
      emptyEntry = path.join(dir, 'no-exports.d.ts');
      fs.writeFileSync(
        path.join(dir, 'package.json'),
        JSON.stringify({ name: 'empty-fixture', version: '1.0.0' }),
      );
      fs.writeFileSync(emptyEntry, 'declare const x: number;\n');
    });

    afterAll(() => {
      fs.rmSync(dir, { recursive: true, force: true });
    });

    it('spec exits 1 and writes no output file', async () => {
      const out = path.join(dir, 'spec.json');
      const { stderr, code } = await run(['spec', emptyEntry, '-o', out]);
      expect(code).toBe(1);
      expect(stderr).toContain('No exports found');
      expect(stderr).toContain(emptyEntry);
      expect(fs.existsSync(out)).toBe(false);
    });

    it('docs exits 1', async () => {
      const { stderr, code } = await run(['docs', emptyEntry]);
      expect(code).toBe(1);
      expect(stderr).toContain('No exports found');
    });

    it('list exits 1', async () => {
      const { stderr, code } = await run(['list', emptyEntry]);
      expect(code).toBe(1);
      expect(stderr).toContain('No exports found');
    });
  });
});
