import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { extract } from './spec-builder';

/**
 * Repro for a dist/entrypoints/index.node.d.ts entry silently
 * extracting nothing (dogfood round 3, Item 1): multi-dot d.ts entry names
 * must extract identically to plain index.d.ts, and a genuinely export-less
 * entry must fail loudly instead of producing an empty spec.
 */

let pkgDir: string;

const DECLS = [
  'export interface CaptureOptions { timestamp?: Date; }',
  'export declare function capture(opts?: CaptureOptions): void;',
].join('\n');

beforeAll(() => {
  pkgDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openpkg-entry-'));
  fs.mkdirSync(path.join(pkgDir, 'dist/entrypoints'), { recursive: true });
  fs.writeFileSync(
    path.join(pkgDir, 'package.json'),
    JSON.stringify({ name: 'entry-names', version: '1.0.0', types: './dist/index.d.ts' }),
  );
  fs.writeFileSync(path.join(pkgDir, 'dist/entrypoints/index.node.d.ts'), DECLS);
  fs.writeFileSync(path.join(pkgDir, 'dist/entrypoints/foo.native.d.ts'), DECLS);
  fs.writeFileSync(path.join(pkgDir, 'dist/no-exports.d.ts'), 'declare const x: number;\n');
  fs.writeFileSync(path.join(pkgDir, 'dist/empty-module.d.ts'), 'export {};\n');
});

afterAll(() => {
  fs.rmSync(pkgDir, { recursive: true, force: true });
});

describe('multi-dot d.ts entry filenames', () => {
  test('index.node.d.ts extracts like any other entry', async () => {
    const { spec, diagnostics } = await extract({
      entryFile: path.join(pkgDir, 'dist/entrypoints/index.node.d.ts'),
    });
    expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(spec.exports.map((e) => e.name).sort()).toEqual(['CaptureOptions', 'capture']);
  });

  test('foo.native.d.ts extracts like any other entry', async () => {
    const { spec, diagnostics } = await extract({
      entryFile: path.join(pkgDir, 'dist/entrypoints/foo.native.d.ts'),
    });
    expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(spec.exports.map((e) => e.name).sort()).toEqual(['CaptureOptions', 'capture']);
  });
});

describe('entry colliding with a tsconfig source declaration-emit target', () => {
  // real-world shape: tsconfig folds src/** into the program, and
  // src/entrypoints/index.node.ts declaration-emits to EXACTLY the entry path.
  test('d.ts entry extracts despite an emitting source in the program', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'openpkg-collide-'));
    try {
      fs.mkdirSync(path.join(dir, 'src/entrypoints'), { recursive: true });
      fs.mkdirSync(path.join(dir, 'dist/entrypoints'), { recursive: true });
      fs.writeFileSync(
        path.join(dir, 'package.json'),
        JSON.stringify({
          name: 'collide',
          version: '1.0.0',
          types: './dist/entrypoints/index.node.d.ts',
        }),
      );
      fs.writeFileSync(
        path.join(dir, 'tsconfig.json'),
        JSON.stringify({
          compilerOptions: { rootDir: './src', outDir: './dist', declaration: true, strict: true },
          include: ['./src/**/*'],
        }),
      );
      fs.writeFileSync(
        path.join(dir, 'src/entrypoints/index.node.ts'),
        'export interface CaptureOptions { timestamp?: Date }\nexport function capture(o?: CaptureOptions): void {}\n',
      );
      fs.writeFileSync(path.join(dir, 'dist/entrypoints/index.node.d.ts'), DECLS);

      const { spec, diagnostics } = await extract({
        entryFile: path.join(dir, 'dist/entrypoints/index.node.d.ts'),
      });
      expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
      expect(spec.exports.map((e) => e.name).sort()).toEqual(['CaptureOptions', 'capture']);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('export-less entries fail loudly', () => {
  test('file with no module symbol yields an error diagnostic naming the entry', async () => {
    const entryFile = path.join(pkgDir, 'dist/no-exports.d.ts');
    const { spec, diagnostics } = await extract({ entryFile });
    expect(spec.exports).toEqual([]);
    const errors = diagnostics.filter((d) => d.severity === 'error');
    expect(errors.length).toBe(1);
    expect(errors[0].message).toContain(entryFile);
  });

  test('module with zero exports yields an error diagnostic naming the entry', async () => {
    const entryFile = path.join(pkgDir, 'dist/empty-module.d.ts');
    const { spec, diagnostics } = await extract({ entryFile });
    expect(spec.exports).toEqual([]);
    const errors = diagnostics.filter((d) => d.severity === 'error');
    expect(errors.length).toBe(1);
    expect(errors[0].message).toContain(entryFile);
  });
});
