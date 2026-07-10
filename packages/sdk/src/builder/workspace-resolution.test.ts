import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { SpecExport } from '@openpkg-ts/spec';
import { extract } from './spec-builder';

/**
 * Repro for workspace-package types resolving as external (a-real-sdk run):
 * a pnpm-style monorepo where the entry re-exports types from a sibling
 * workspace package linked via node_modules symlink.
 */

let workspaceRoot: string;
let browserDir: string;

function writeCorePackage(withSrc: boolean): void {
  const coreDir = path.join(workspaceRoot, 'packages/core');
  fs.rmSync(coreDir, { recursive: true, force: true });
  fs.mkdirSync(path.join(coreDir, withSrc ? 'src' : 'dist'), { recursive: true });

  const decls = [
    'export interface CaptureOptions { timestamp?: Date; send_instantly?: boolean; }',
    'export type BeforeSendFn = (cr: CaptureOptions | null) => CaptureOptions | null;',
  ].join('\n');

  fs.writeFileSync(
    path.join(coreDir, 'package.json'),
    JSON.stringify({
      name: '@acme/core',
      version: '1.0.0',
      main: './dist/index.js',
      types: './dist/index.d.ts',
    }),
  );
  if (withSrc) {
    fs.writeFileSync(path.join(coreDir, 'src/index.ts'), decls);
  } else {
    fs.writeFileSync(path.join(coreDir, 'dist/index.d.ts'), decls);
  }
}

beforeAll(() => {
  workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'openpkg-ws-'));
  browserDir = path.join(workspaceRoot, 'packages/browser');

  fs.writeFileSync(
    path.join(workspaceRoot, 'pnpm-workspace.yaml'),
    "packages:\n  - 'packages/*'\n",
  );
  writeCorePackage(true);

  fs.mkdirSync(path.join(browserDir, 'src/entrypoints'), { recursive: true });
  fs.writeFileSync(
    path.join(browserDir, 'package.json'),
    JSON.stringify({
      name: '@acme/browser',
      version: '1.0.0',
      dependencies: { '@acme/core': 'workspace:^' },
    }),
  );
  fs.writeFileSync(
    path.join(browserDir, 'src/entrypoints/module.es.ts'),
    [
      "import type { CaptureOptions } from '@acme/core';",
      "export type { CaptureOptions, BeforeSendFn } from '@acme/core';",
      'export function capture(event: string, options?: CaptureOptions): void {}',
    ].join('\n'),
  );

  // pnpm-style workspace symlink
  fs.mkdirSync(path.join(workspaceRoot, 'node_modules/@acme'), { recursive: true });
  fs.symlinkSync(
    path.join(workspaceRoot, 'packages/core'),
    path.join(workspaceRoot, 'node_modules/@acme/core'),
  );
});

afterAll(() => {
  fs.rmSync(workspaceRoot, { recursive: true, force: true });
});

function byName(exports: SpecExport[], name: string): SpecExport | undefined {
  return exports.find((e) => e.name === name);
}

describe('workspace package resolution', () => {
  test('resolves re-exported workspace types with an absolute entry path', async () => {
    const { spec } = await extract({
      entryFile: path.join(browserDir, 'src/entrypoints/module.es.ts'),
    });

    expect(byName(spec.exports, 'CaptureOptions')?.kind).toBe('interface');
    expect(byName(spec.exports, 'BeforeSendFn')?.kind).toBe('type');

    const schema = byName(spec.exports, 'CaptureOptions')?.schema as Record<string, unknown>;
    expect(schema.properties).toHaveProperty('send_instantly');
  });

  test('resolves re-exported workspace types with a relative entry path', async () => {
    const prevCwd = process.cwd();
    process.chdir(browserDir);
    try {
      const { spec } = await extract({ entryFile: 'src/entrypoints/module.es.ts' });

      // Before the fix: relative entry broke the workspace-root walk and
      // node_modules lookup, so these came out as kind 'external' with no shape.
      expect(byName(spec.exports, 'CaptureOptions')?.kind).toBe('interface');
      expect(byName(spec.exports, 'BeforeSendFn')?.kind).toBe('type');

      // Source paths stay relative to cwd
      expect(byName(spec.exports, 'capture')?.source?.file).toBe('src/entrypoints/module.es.ts');
    } finally {
      process.chdir(prevCwd);
    }
  });

  test('falls back to package.json types field when src/index.ts is absent', async () => {
    writeCorePackage(false);
    try {
      const { spec } = await extract({
        entryFile: path.join(browserDir, 'src/entrypoints/module.es.ts'),
      });

      expect(byName(spec.exports, 'CaptureOptions')?.kind).toBe('interface');
      const schema = byName(spec.exports, 'CaptureOptions')?.schema as Record<string, unknown>;
      expect(schema.properties).toHaveProperty('timestamp');
    } finally {
      writeCorePackage(true);
    }
  });
});
