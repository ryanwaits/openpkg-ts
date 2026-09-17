import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { catalogPackages, pickEntry, resolveTarget } from './resolve-target';

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

  test('single package prefers src over dist types', () => {
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

    const result = resolveTarget({ input: tmp, cwd: tmp });
    expect(result.kind).toBe('ok');
    if (result.kind !== 'ok') return;
    expect(result.entryFile).toBe(path.join(tmp, 'src/index.ts'));
    expect(result.entryPointSource).toBe('fallback');
  });

  test('falls back to types field when src is absent', () => {
    write(
      path.join(tmp, 'package.json'),
      JSON.stringify({
        name: 'decls',
        types: './index.d.ts',
      }),
    );
    write(path.join(tmp, 'index.d.ts'), 'export declare const x: number;\n');

    const result = resolveTarget({ input: tmp, cwd: tmp });
    expect(result.kind).toBe('ok');
    if (result.kind !== 'ok') return;
    expect(result.entryFile).toBe(path.join(tmp, 'index.d.ts'));
    expect(result.entryPointSource).toBe('types');
  });

  test('explicit file skips funnel', () => {
    write(path.join(tmp, 'package.json'), JSON.stringify({ name: 'solo' }));
    write(path.join(tmp, 'src/index.ts'), 'export const a = 1;\n');
    write(path.join(tmp, 'src/other.ts'), 'export const b = 2;\n');

    const result = resolveTarget({ input: path.join(tmp, 'src/other.ts'), cwd: tmp });
    expect(result.kind).toBe('explicit');
    if (result.kind !== 'explicit') return;
    expect(result.entryFile).toBe(path.join(tmp, 'src/other.ts'));
  });

  test('workspace without intent is ambiguous', () => {
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

    const result = resolveTarget({ input: tmp, cwd: tmp });
    expect(result.kind).toBe('ambiguous');
    if (result.kind !== 'ambiguous') return;
    expect(result.candidates.map((c) => c.name).sort()).toEqual(['@acme/cli', '@acme/sdk']);
  });

  test('intent picks the matching package', () => {
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

    const result = resolveTarget({ input: tmp, intent: 'stacks', cwd: tmp });
    expect(result.kind).toBe('ok');
    if (result.kind !== 'ok') return;
    expect(result.package.name).toBe('@secondlayer/stacks');
    expect(result.entryPointSource).toBe('fallback');
  });

  test('pointing at a package dir wins', () => {
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

    const result = resolveTarget({ input: path.join(tmp, 'packages/cli'), cwd: tmp });
    expect(result.kind).toBe('ok');
    if (result.kind !== 'ok') return;
    expect(result.package.name).toBe('@acme/cli');
  });

  test('cwd inside a package picks that package', () => {
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

    const result = resolveTarget({ cwd: path.join(tmp, 'packages/sdk') });
    expect(result.kind).toBe('ok');
    if (result.kind !== 'ok') return;
    expect(result.package.name).toBe('@acme/sdk');
  });

  test('skips private and examples packages', () => {
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

    const result = resolveTarget({ input: tmp, cwd: tmp });
    expect(result.kind).toBe('ok');
    if (result.kind !== 'ok') return;
    expect(result.package.name).toBe('@acme/sdk');
  });

  test('needs-build when no entry files exist', () => {
    write(
      path.join(tmp, 'package.json'),
      JSON.stringify({
        name: 'wasm-pkg',
        types: './dist/index.d.ts',
        scripts: { build: 'wasm-pack build' },
      }),
    );

    const result = resolveTarget({ input: tmp, cwd: tmp });
    expect(result.kind).toBe('needs-build');
    if (result.kind !== 'needs-build') return;
    expect(result.command).toBe('bun run build');
  });

  test('remote input is classified, not cloned', () => {
    const result = resolveTarget({ input: 'https://github.com/stx-labs/clarinet', cwd: tmp });
    expect(result.kind).toBe('remote');
  });

  test('catalog walks pnpm-workspace.yaml', () => {
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

  test('pickEntry scores source above d.ts', () => {
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
});
