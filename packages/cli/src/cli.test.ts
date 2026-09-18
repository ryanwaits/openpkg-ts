import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CLI = path.join(import.meta.dir, 'index.ts');
const FIXTURE = path.join(import.meta.dir, '..', 'test-fixtures', 'sample.ts');

async function run(
  args: string[],
  cwd?: string,
  env?: Record<string, string | undefined>,
): Promise<{ stdout: string; stderr: string; code: number }> {
  const proc = Bun.spawn(['bun', CLI, ...args], {
    cwd,
    env: env as Record<string, string> | undefined,
    stdout: 'pipe',
    stderr: 'pipe',
  });
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

  describe('external types (follow / config)', () => {
    let dir: string;
    let entry: string;

    beforeAll(() => {
      dir = fs.mkdtempSync(path.join(os.tmpdir(), 'openpkg-cli-ext-'));
      fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'consumer' }));
      const pkg = path.join(dir, 'node_modules', 'ext-lib');
      fs.mkdirSync(pkg, { recursive: true });
      fs.writeFileSync(
        path.join(pkg, 'package.json'),
        JSON.stringify({ name: 'ext-lib', types: 'index.d.ts' }),
      );
      fs.writeFileSync(path.join(pkg, 'index.d.ts'), 'export interface Widget { id: string; }\n');
      entry = path.join(dir, 'index.ts');
      fs.writeFileSync(
        entry,
        `import type { Widget } from 'ext-lib';\nexport function use(w: Widget): void {}\n`,
      );
    });
    afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

    it('default stubs externals and reports the declaring package', async () => {
      const { stdout, stderr, code } = await run(['spec', entry]);
      expect(code).toBe(0);
      expect(stderr).toContain('stubbed from: ext-lib');
      const spec = JSON.parse(stdout);
      const widget = spec.types.find((t: { name: string }) => t.name === 'Widget');
      expect(widget.external).toBe(true);
      expect(widget.schema['x-ts-package']).toBe('ext-lib');
    });

    // Platform globals (lib.dom / lib.es) are stubbed by design and can never
    // be followed, so they stay out of the "add to followExternal" report.
    it('stub report lists followable packages only, never platform globals', async () => {
      const mixed = path.join(dir, 'mixed.ts');
      fs.writeFileSync(
        mixed,
        `import type { Widget } from 'ext-lib';\nexport function use(w: Widget, s: AbortSignal): void {}\n`,
      );
      const a = await run(['spec', mixed]);
      expect(a.code).toBe(0);
      expect(a.stderr).toContain('stubbed from: ext-lib (1)');
      expect(a.stderr).not.toContain('unknown origin');

      const globalsOnly = path.join(dir, 'globals.ts');
      fs.writeFileSync(globalsOnly, 'export function stop(s: AbortSignal): void {}\n');
      const b = await run(['spec', globalsOnly]);
      expect(b.code).toBe(0);
      expect(b.stderr).not.toContain('stubbed');
      expect(b.stderr).not.toContain('followExternal');
    });

    it('--follow-external expands the named package', async () => {
      const { stdout, code } = await run(['spec', entry, '--follow-external', 'ext-lib']);
      expect(code).toBe(0);
      const spec = JSON.parse(stdout);
      const widget = spec.types.find((t: { name: string }) => t.name === 'Widget');
      expect(widget.schema.properties.id).toEqual({ type: 'string' });
    });
  });

  describe('validate', () => {
    let dir: string;

    beforeAll(() => {
      dir = fs.mkdtempSync(path.join(os.tmpdir(), 'openpkg-cli-validate-'));
    });
    afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

    it('help lists validate and diff --json', async () => {
      const { stdout } = await run(['--help']);
      expect(stdout).toContain('openpkg validate');
      expect(stdout).toContain('diff <old.json> <new.json> [--json]');
    });

    it('accepts a spec produced by the spec command', async () => {
      const specFile = path.join(dir, 'valid.json');
      const { stdout: specOut } = await run(['spec', FIXTURE]);
      fs.writeFileSync(specFile, specOut);
      const { stdout, code } = await run(['validate', specFile]);
      expect(code).toBe(0);
      expect(stdout).toContain('valid');
    });

    it('rejects a spec missing required fields', async () => {
      const bad = path.join(dir, 'bad.json');
      fs.writeFileSync(bad, JSON.stringify({ openpkg: '0.4.0', exports: [] }));
      const { stderr, code } = await run(['validate', bad]);
      expect(code).toBe(1);
      expect(stderr).toContain('meta');
    });

    it('rejects a non-JSON file cleanly', async () => {
      const junk = path.join(dir, 'junk.json');
      fs.writeFileSync(junk, 'not json{');
      const { stderr, code } = await run(['validate', junk]);
      expect(code).toBe(1);
      expect(stderr).toContain('failed to read');
    });
  });

  describe('diff hardening + --json', () => {
    let dir: string;

    beforeAll(() => {
      dir = fs.mkdtempSync(path.join(os.tmpdir(), 'openpkg-cli-diff-'));
    });
    afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

    const writeSpec = (name: string, spec: unknown): string => {
      const file = path.join(dir, name);
      fs.writeFileSync(file, JSON.stringify(spec));
      return file;
    };

    it('fails cleanly on a structurally invalid spec instead of crashing', async () => {
      const garbage = writeSpec('garbage.json', { foo: 1 });
      const valid = writeSpec('v.json', {
        openpkg: '0.4.0',
        meta: { name: 't', version: '1.0.0' },
        exports: [],
      });
      const { stderr, code } = await run(['diff', garbage, valid]);
      expect(code).toBe(1);
      expect(stderr).toContain('invalid spec');
    });

    it('--json emits a machine-readable payload and exits 2 on breaking', async () => {
      const oldSpec = writeSpec('old.json', {
        openpkg: '0.4.0',
        meta: { name: 't', version: '1.0.0' },
        exports: [{ id: 'foo', name: 'foo', kind: 'function' }],
      });
      const newSpec = writeSpec('new.json', {
        openpkg: '0.4.0',
        meta: { name: 't', version: '1.0.0' },
        exports: [],
      });
      const { stdout, code } = await run(['diff', oldSpec, newSpec, '--json']);
      expect(code).toBe(2);
      const payload = JSON.parse(stdout);
      expect(payload.recommendation.bump).toBe('major');
      expect(payload.breaking.length).toBeGreaterThan(0);
      expect(payload.nextVersion).toBe('2.0.0');
    });
  });

  describe('target resolution', () => {
    let dir: string;

    beforeAll(() => {
      dir = fs.mkdtempSync(path.join(os.tmpdir(), 'openpkg-cli-resolve-'));
      fs.writeFileSync(
        path.join(dir, 'package.json'),
        JSON.stringify({
          name: 'root',
          private: true,
          workspaces: ['packages/*'],
        }),
      );
      const sdk = path.join(dir, 'packages/sdk');
      fs.mkdirSync(path.join(sdk, 'src'), { recursive: true });
      fs.writeFileSync(path.join(sdk, 'package.json'), JSON.stringify({ name: '@acme/sdk' }));
      fs.writeFileSync(path.join(sdk, 'src/index.ts'), 'export const sdk = 1;\n');
      const stacks = path.join(dir, 'packages/stacks');
      fs.mkdirSync(path.join(stacks, 'src'), { recursive: true });
      fs.writeFileSync(
        path.join(stacks, 'package.json'),
        JSON.stringify({ name: '@secondlayer/stacks', description: 'Typed Stacks client' }),
      );
      fs.writeFileSync(path.join(stacks, 'src/index.ts'), 'export const stacks = 1;\n');
    });

    afterAll(() => {
      fs.rmSync(dir, { recursive: true, force: true });
    });

    it('spec with no args from a package dir extracts', async () => {
      const pkg = path.join(dir, 'packages/sdk');
      const { stdout, code } = await run(['spec'], pkg);
      expect(code).toBe(0);
      const spec = JSON.parse(stdout);
      expect(spec.exports.map((e: { name: string }) => e.name)).toContain('sdk');
      expect(spec.generation.entryPointSource).toBe('fallback');
    });

    it('spec with intent picks the matching package', async () => {
      const { stdout, code } = await run(['spec', '.', 'stacks'], dir);
      expect(code).toBe(0);
      const spec = JSON.parse(stdout);
      expect(spec.exports.map((e: { name: string }) => e.name)).toContain('stacks');
      expect(spec.meta.name).toBe('@secondlayer/stacks');
    });

    it('spec at workspace root without intent lists packages', async () => {
      const { stderr, code } = await run(['spec'], dir);
      expect(code).toBe(1);
      expect(stderr).toContain('multiple packages');
      expect(stderr).toContain('@acme/sdk');
      expect(stderr).toContain('@secondlayer/stacks');
    });

    it('spec records explicit entryPointSource for a file', async () => {
      const { stdout, code } = await run(['spec', FIXTURE]);
      expect(code).toBe(0);
      const spec = JSON.parse(stdout);
      expect(spec.generation.entryPointSource).toBe('explicit');
    });

    it('missing file path fails instead of extracting cwd', async () => {
      const pkg = path.join(dir, 'packages/sdk');
      const { stderr, code, stdout } = await run(['spec', 'missing.ts'], pkg);
      expect(code).toBe(1);
      expect(stderr).toContain('does not exist');
      expect(stdout).toBe('');
    });
  });
});
