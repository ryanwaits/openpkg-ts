import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  catalogPackages,
  cloneRemote,
  parseGithubRepo,
  pickEntry,
  resolveTarget,
} from './resolve-target';

function write(file: string, content: string) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

describe('resolveTarget', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'openpkg-resolve-'));
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  test('single package prefers src over dist types', async () => {
    write(
      path.join(tmp, 'package.json'),
      JSON.stringify({
        name: 'solo',
        types: './dist/index.d.ts',
        main: './dist/index.js',
      }),
    );
    write(path.join(tmp, 'src/index.ts'), 'export const ok = 1;\n');
    write(path.join(tmp, 'dist/index.d.ts'), 'export declare const ok: number;\n');

    const result = await resolveTarget({ input: tmp, cwd: tmp });
    expect(result.kind).toBe('ok');
    if (result.kind !== 'ok') return;
    expect(result.entryFile).toBe(path.join(tmp, 'src/index.ts'));
    expect(result.entryPointSource).toBe('fallback');
  });

  test('falls back to types field when src is absent', async () => {
    write(
      path.join(tmp, 'package.json'),
      JSON.stringify({
        name: 'decls',
        types: './index.d.ts',
      }),
    );
    write(path.join(tmp, 'index.d.ts'), 'export declare const x: number;\n');

    const result = await resolveTarget({ input: tmp, cwd: tmp });
    expect(result.kind).toBe('ok');
    if (result.kind !== 'ok') return;
    expect(result.entryFile).toBe(path.join(tmp, 'index.d.ts'));
    expect(result.entryPointSource).toBe('types');
  });

  test('explicit file skips funnel', async () => {
    write(path.join(tmp, 'package.json'), JSON.stringify({ name: 'solo' }));
    write(path.join(tmp, 'src/index.ts'), 'export const a = 1;\n');
    write(path.join(tmp, 'src/other.ts'), 'export const b = 2;\n');

    const result = await resolveTarget({ input: path.join(tmp, 'src/other.ts'), cwd: tmp });
    expect(result.kind).toBe('explicit');
    if (result.kind !== 'explicit') return;
    expect(result.entryFile).toBe(path.join(tmp, 'src/other.ts'));
  });

  test('workspace without intent is ambiguous', async () => {
    write(
      path.join(tmp, 'package.json'),
      JSON.stringify({
        name: 'root',
        private: true,
        workspaces: ['packages/*'],
      }),
    );
    write(path.join(tmp, 'packages/sdk/package.json'), JSON.stringify({ name: '@acme/sdk' }));
    write(path.join(tmp, 'packages/sdk/src/index.ts'), 'export const sdk = 1;\n');
    write(path.join(tmp, 'packages/cli/package.json'), JSON.stringify({ name: '@acme/cli' }));
    write(path.join(tmp, 'packages/cli/src/index.ts'), 'export const cli = 1;\n');

    const result = await resolveTarget({ input: tmp, cwd: tmp });
    expect(result.kind).toBe('ambiguous');
    if (result.kind !== 'ambiguous') return;
    expect(result.candidates.map((c) => c.name).sort()).toEqual(['@acme/cli', '@acme/sdk']);
  });

  test('intent picks the matching package', async () => {
    write(
      path.join(tmp, 'package.json'),
      JSON.stringify({
        name: 'root',
        private: true,
        workspaces: ['packages/*'],
      }),
    );
    write(path.join(tmp, 'packages/sdk/package.json'), JSON.stringify({ name: '@acme/sdk' }));
    write(path.join(tmp, 'packages/sdk/src/index.ts'), 'export const sdk = 1;\n');
    write(
      path.join(tmp, 'packages/stacks/package.json'),
      JSON.stringify({
        name: '@secondlayer/stacks',
        description: 'Typed Stacks client',
      }),
    );
    write(path.join(tmp, 'packages/stacks/src/index.ts'), 'export const stacks = 1;\n');

    const result = await resolveTarget({ input: tmp, intent: 'stacks', cwd: tmp });
    expect(result.kind).toBe('ok');
    if (result.kind !== 'ok') return;
    expect(result.package.name).toBe('@secondlayer/stacks');
    expect(result.entryPointSource).toBe('fallback');
  });

  test('pointing at a package dir wins', async () => {
    write(
      path.join(tmp, 'package.json'),
      JSON.stringify({
        name: 'root',
        private: true,
        workspaces: ['packages/*'],
      }),
    );
    write(path.join(tmp, 'packages/sdk/package.json'), JSON.stringify({ name: '@acme/sdk' }));
    write(path.join(tmp, 'packages/sdk/src/index.ts'), 'export const sdk = 1;\n');
    write(path.join(tmp, 'packages/cli/package.json'), JSON.stringify({ name: '@acme/cli' }));
    write(path.join(tmp, 'packages/cli/src/index.ts'), 'export const cli = 1;\n');

    const result = await resolveTarget({ input: path.join(tmp, 'packages/cli'), cwd: tmp });
    expect(result.kind).toBe('ok');
    if (result.kind !== 'ok') return;
    expect(result.package.name).toBe('@acme/cli');
  });

  test('cwd inside a package picks that package', async () => {
    write(
      path.join(tmp, 'package.json'),
      JSON.stringify({
        name: 'root',
        private: true,
        workspaces: ['packages/*'],
      }),
    );
    write(path.join(tmp, 'packages/sdk/package.json'), JSON.stringify({ name: '@acme/sdk' }));
    write(path.join(tmp, 'packages/sdk/src/index.ts'), 'export const sdk = 1;\n');
    write(path.join(tmp, 'packages/cli/package.json'), JSON.stringify({ name: '@acme/cli' }));
    write(path.join(tmp, 'packages/cli/src/index.ts'), 'export const cli = 1;\n');

    const result = await resolveTarget({ cwd: path.join(tmp, 'packages/sdk') });
    expect(result.kind).toBe('ok');
    if (result.kind !== 'ok') return;
    expect(result.package.name).toBe('@acme/sdk');
  });

  test('skips private and examples packages', async () => {
    write(
      path.join(tmp, 'package.json'),
      JSON.stringify({
        name: 'root',
        private: true,
        workspaces: ['packages/*', 'examples/*'],
      }),
    );
    write(path.join(tmp, 'packages/sdk/package.json'), JSON.stringify({ name: '@acme/sdk' }));
    write(path.join(tmp, 'packages/sdk/src/index.ts'), 'export const sdk = 1;\n');
    write(
      path.join(tmp, 'packages/internal/package.json'),
      JSON.stringify({
        name: '@acme/internal',
        private: true,
      }),
    );
    write(path.join(tmp, 'packages/internal/src/index.ts'), 'export const hidden = 1;\n');
    write(path.join(tmp, 'examples/demo/package.json'), JSON.stringify({ name: '@acme/demo' }));
    write(path.join(tmp, 'examples/demo/src/index.ts'), 'export const demo = 1;\n');

    const result = await resolveTarget({ input: tmp, cwd: tmp });
    expect(result.kind).toBe('ok');
    if (result.kind !== 'ok') return;
    expect(result.package.name).toBe('@acme/sdk');
  });

  test('needs-build when no entry files exist', async () => {
    write(
      path.join(tmp, 'package.json'),
      JSON.stringify({
        name: 'wasm-pkg',
        types: './dist/index.d.ts',
        scripts: { build: 'wasm-pack build' },
      }),
    );

    const result = await resolveTarget({ input: tmp, cwd: tmp });
    expect(result.kind).toBe('needs-build');
    if (result.kind !== 'needs-build') return;
    expect(result.command).toBe('bun run build');
  });

  test('remote input clones then resolves', async () => {
    const repo = path.join(tmp, 'upstream');
    write(path.join(repo, 'package.json'), JSON.stringify({ name: 'cloned' }));
    write(path.join(repo, 'src/index.ts'), 'export const cloned = 1;\n');
    const result = await resolveTarget({
      input: 'https://github.com/example/cloned',
      cwd: tmp,
      clone: async () => repo,
    });
    expect(result.kind).toBe('ok');
    if (result.kind !== 'ok') return;
    expect(result.package.name).toBe('cloned');
  });

  test('cloneRemote clones a local git repo', async () => {
    const repo = path.join(tmp, 'src-repo');
    write(path.join(repo, 'package.json'), JSON.stringify({ name: 'from-git' }));
    write(path.join(repo, 'src/index.ts'), 'export const fromGit = 1;\n');
    const git = (args: string[]) =>
      spawnSync('git', args, { cwd: repo, encoding: 'utf8', stdio: 'pipe' });
    git(['init']);
    git(['add', '.']);
    const commit = git(['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-m', 'init']);
    if (commit.status !== 0) return;
    const dest = await cloneRemote(repo);
    try {
      expect(fs.existsSync(path.join(dest, 'package.json'))).toBe(true);
      const result = await resolveTarget({ input: dest, cwd: dest });
      expect(result.kind).toBe('ok');
      if (result.kind === 'ok') expect(result.package.name).toBe('from-git');
    } finally {
      fs.rmSync(dest, { recursive: true, force: true });
    }
  });

  test('parseGithubRepo reads owner/repo', () => {
    expect(parseGithubRepo('https://github.com/stx-labs/clarinet')).toEqual({
      owner: 'stx-labs',
      repo: 'clarinet',
    });
    expect(parseGithubRepo('git@github.com:stx-labs/clarinet.git')).toEqual({
      owner: 'stx-labs',
      repo: 'clarinet',
    });
  });

  test('catalog walks pnpm-workspace.yaml', async () => {
    write(path.join(tmp, 'pnpm-workspace.yaml'), "packages:\n  - 'packages/*'\n");
    write(path.join(tmp, 'package.json'), JSON.stringify({ name: 'root', private: true }));
    write(path.join(tmp, 'packages/a/package.json'), JSON.stringify({ name: 'a' }));
    write(path.join(tmp, 'packages/b/package.json'), JSON.stringify({ name: 'b' }));

    const names = catalogPackages(tmp)
      .map((p) => p.name)
      .sort();
    expect(names).toContain('a');
    expect(names).toContain('b');
  });

  test('pickEntry scores source above d.ts', async () => {
    write(
      path.join(tmp, 'package.json'),
      JSON.stringify({
        name: 'mix',
        types: './dist/index.d.ts',
        exports: { '.': { types: './dist/index.d.ts', import: './dist/index.js' } },
      }),
    );
    write(path.join(tmp, 'src/index.ts'), 'export const v = 1;\n');
    write(path.join(tmp, 'dist/index.d.ts'), 'export declare const v: number;\n');
    write(path.join(tmp, 'dist/index.js'), 'export const v = 1;\n');

    const picked = pickEntry(tmp);
    expect(picked?.entryFile).toBe(path.join(tmp, 'src/index.ts'));
    expect(picked?.entryPointSource).toBe('fallback');
  });

  test('pickEntry accepts a string-form exports field', async () => {
    write(
      path.join(tmp, 'package.json'),
      JSON.stringify({ name: 'str-exp', exports: './lib/api.ts' }),
    );
    write(path.join(tmp, 'lib/api.ts'), 'export const api = 1;\n');
    const picked = pickEntry(tmp);
    expect(picked?.entryFile).toBe(path.join(tmp, 'lib/api.ts'));
    expect(picked?.entryPointSource).toBe('exports');
  });

  test('pickEntry walks fallback arrays in exports', async () => {
    write(
      path.join(tmp, 'package.json'),
      JSON.stringify({
        name: 'arr-exp',
        exports: { '.': [{ types: './missing.d.ts' }, './lib/api.ts'] },
      }),
    );
    write(path.join(tmp, 'lib/api.ts'), 'export const api = 1;\n');
    const picked = pickEntry(tmp);
    expect(picked?.entryFile).toBe(path.join(tmp, 'lib/api.ts'));
  });

  test('workspace root resolves a package that only exposes exports', async () => {
    write(
      path.join(tmp, 'package.json'),
      JSON.stringify({ name: 'root', private: true, workspaces: ['packages/*'] }),
    );
    write(
      path.join(tmp, 'packages/pub/package.json'),
      JSON.stringify({ name: '@acme/pub', exports: { '.': './lib/api.ts' } }),
    );
    write(path.join(tmp, 'packages/pub/lib/api.ts'), 'export const api = 1;\n');

    const result = await resolveTarget({ input: tmp, cwd: tmp });
    expect(result.kind).toBe('ok');
    if (result.kind !== 'ok') return;
    expect(result.package.name).toBe('@acme/pub');
    expect(result.entryFile).toBe(path.join(tmp, 'packages/pub/lib/api.ts'));
  });

  test('workspace globs honor exclusions and partial wildcards', async () => {
    write(
      path.join(tmp, 'package.json'),
      JSON.stringify({
        name: 'root',
        private: true,
        workspaces: ['packages/*', '!packages/excluded'],
      }),
    );
    write(path.join(tmp, 'packages/keep/package.json'), JSON.stringify({ name: 'keep' }));
    write(path.join(tmp, 'packages/keep/src/index.ts'), 'export const keep = 1;\n');
    write(path.join(tmp, 'packages/excluded/package.json'), JSON.stringify({ name: 'excluded' }));
    write(path.join(tmp, 'packages/excluded/src/index.ts'), 'export const excluded = 1;\n');

    const names = catalogPackages(tmp).map((p) => p.name);
    expect(names).toContain('keep');
    expect(names).not.toContain('excluded');
  });

  test('workspace globs match partial wildcards', async () => {
    write(
      path.join(tmp, 'package.json'),
      JSON.stringify({ name: 'root', private: true, workspaces: ['packages/sdk-*'] }),
    );
    write(path.join(tmp, 'packages/sdk-core/package.json'), JSON.stringify({ name: 'sdk-core' }));
    write(path.join(tmp, 'packages/sdk-core/src/index.ts'), 'export const core = 1;\n');
    write(path.join(tmp, 'packages/cli/package.json'), JSON.stringify({ name: 'cli' }));
    write(path.join(tmp, 'packages/cli/src/index.ts'), 'export const cli = 1;\n');

    const names = catalogPackages(tmp).map((p) => p.name);
    expect(names).toContain('sdk-core');
    expect(names).not.toContain('cli');
  });

  test('pnpm workspace yaml exclusions are applied', async () => {
    write(
      path.join(tmp, 'pnpm-workspace.yaml'),
      "packages:\n  - 'packages/*'\n  - '!packages/excluded'\n",
    );
    write(path.join(tmp, 'package.json'), JSON.stringify({ name: 'root', private: true }));
    write(path.join(tmp, 'packages/keep/package.json'), JSON.stringify({ name: 'keep' }));
    write(path.join(tmp, 'packages/excluded/package.json'), JSON.stringify({ name: 'excluded' }));

    const names = catalogPackages(tmp).map((p) => p.name);
    expect(names).toContain('keep');
    expect(names).not.toContain('excluded');
  });

  test('missing path-like input does not fall back to cwd', async () => {
    write(path.join(tmp, 'package.json'), JSON.stringify({ name: 'solo' }));
    write(path.join(tmp, 'src/index.ts'), 'export const ok = 1;\n');

    const missing = await resolveTarget({ input: 'missing.ts', cwd: tmp });
    expect(missing.kind).toBe('empty');
    if (missing.kind === 'empty') expect(missing.reason).toContain('does not exist');

    const rel = await resolveTarget({ input: './nope', cwd: tmp });
    expect(rel.kind).toBe('empty');

    const abs = await resolveTarget({ input: path.join(tmp, 'gone.ts'), cwd: tmp });
    expect(abs.kind).toBe('empty');
  });

  test('injected clone is caller-owned and has no cleanup', async () => {
    const repo = path.join(tmp, 'upstream');
    write(path.join(repo, 'package.json'), JSON.stringify({ name: 'cloned' }));
    write(path.join(repo, 'src/index.ts'), 'export const cloned = 1;\n');
    const result = await resolveTarget({
      input: 'https://github.com/example/cloned',
      cwd: tmp,
      clone: async () => repo,
    });
    expect(result.kind).toBe('ok');
    expect(result.cleanup).toBeUndefined();
    expect(fs.existsSync(repo)).toBe(true);
  });

  test('resolver-owned clone attaches cleanup', async () => {
    const repo = path.join(tmp, 'upstream');
    write(path.join(repo, 'package.json'), JSON.stringify({ name: 'cloned' }));
    write(path.join(repo, 'src/index.ts'), 'export const cloned = 1;\n');
    const bin = path.join(tmp, 'bin');
    fs.mkdirSync(bin);
    write(
      path.join(bin, 'gh'),
      `#!/bin/sh\ndest="$4"\nmkdir -p "$dest"\ncp -R '${repo}/.' "$dest"/\n`,
    );
    fs.chmodSync(path.join(bin, 'gh'), 0o755);
    const prevPath = process.env.PATH;
    process.env.PATH = `${bin}${path.delimiter}${prevPath ?? ''}`;
    const before = new Set(fs.readdirSync(os.tmpdir()).filter((n) => n.startsWith('openpkg-')));
    try {
      const result = await resolveTarget({
        input: 'https://github.com/example/cloned',
        cwd: tmp,
      });
      expect(result.kind).toBe('ok');
      expect(typeof result.cleanup).toBe('function');
      const created = fs
        .readdirSync(os.tmpdir())
        .filter((n) => n.startsWith('openpkg-') && !before.has(n));
      expect(created.length).toBeGreaterThan(0);
      const dest = path.join(os.tmpdir(), created[0]);
      expect(fs.existsSync(path.join(dest, 'package.json'))).toBe(true);
      result.cleanup?.();
      expect(fs.existsSync(dest)).toBe(false);
    } finally {
      process.env.PATH = prevPath;
    }
  });
});
