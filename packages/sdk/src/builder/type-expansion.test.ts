import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { extract } from './spec-builder';

/**
 * Repro for the round-3 gap: types declared in a workspace dependency,
 * referenced by the public surface but never re-exported from the entry,
 * must land in types[] (api-extractor bundles these; 0.8.4 dropped dozens
 * of a real SDK's published types). Covers the three erasure modes:
 * utility-type flattening (Omit target), checker-erased aliases
 * (`type X = any`, indexed-access unions), and namespace-qualified refs.
 */

let workspaceRoot: string;
let appDir: string;

beforeAll(() => {
  workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'openpkg-expand-'));
  appDir = path.join(workspaceRoot, 'packages/app');
  const coreDir = path.join(workspaceRoot, 'packages/core');

  fs.writeFileSync(
    path.join(workspaceRoot, 'pnpm-workspace.yaml'),
    "packages:\n  - 'packages/*'\n",
  );

  fs.mkdirSync(path.join(coreDir, 'src/tracking'), { recursive: true });
  fs.writeFileSync(
    path.join(coreDir, 'package.json'),
    JSON.stringify({ name: '@acme/core', version: '1.0.0', types: './dist/index.d.ts' }),
  );
  fs.writeFileSync(
    path.join(coreDir, 'src/index.ts'),
    [
      "export * as Tracking from './tracking';",
      'export interface CoreOptions {',
      '  /** Base host */',
      '  host?: string;',
      '  level?: CoreLevel;',
      '  flush_interval?: number;',
      '}',
      "const levels = ['debug', 'error'] as const;",
      'export type CoreLevel = (typeof levels)[number];',
      'export type AnyEvent = any;',
      'export declare function coreProcess(event: AnyEvent): AnyEvent;',
    ].join('\n'),
  );
  fs.writeFileSync(
    path.join(coreDir, 'src/tracking/index.ts'),
    [
      'export interface TrackedError { message: string; level?: number; }',
      'export type ErrorCoercer = (err: TrackedError) => TrackedError | null;',
      'export class ErrorBuilder { build(err: TrackedError): TrackedError { return err; } }',
    ].join('\n'),
  );

  fs.mkdirSync(path.join(appDir, 'src'), { recursive: true });
  fs.writeFileSync(
    path.join(appDir, 'package.json'),
    JSON.stringify({
      name: '@acme/app',
      version: '1.0.0',
      dependencies: { '@acme/core': 'workspace:^' },
    }),
  );
  fs.writeFileSync(
    path.join(appDir, 'src/index.ts'),
    [
      "import type { CoreOptions, AnyEvent } from '@acme/core';",
      "import { Tracking } from '@acme/core';",
      '// Omit flattens CoreOptions away in the schema — expansion must keep it',
      "export type AppOptions = Omit<CoreOptions, 'flush_interval'> & { app_name: string };",
      '// external base, some omitted keys re-declared in the literal',
      "export type StrictOptions = Omit<CoreOptions, 'host' | 'flush_interval'> & {",
      '  flush_interval?: number;',
      '  strict: boolean;',
      '};',
      'export declare function processEvent(event: AnyEvent): AnyEvent;',
      'export declare class App {',
      '  protected builder(): Tracking.ErrorBuilder;',
      '  configure(options: AppOptions): void;',
      '}',
    ].join('\n'),
  );

  fs.mkdirSync(path.join(workspaceRoot, 'node_modules/@acme'), { recursive: true });
  fs.symlinkSync(
    path.join(workspaceRoot, 'packages/core'),
    path.join(workspaceRoot, 'node_modules/@acme/core'),
  );
});

afterAll(() => {
  fs.rmSync(workspaceRoot, { recursive: true, force: true });
});

describe('reachable workspace-dep type expansion', () => {
  test('Omit-flattened workspace type is registered with full schema', async () => {
    const { spec } = await extract({ entryFile: path.join(appDir, 'src/index.ts') });
    const t = spec.types?.find((t) => t.name === 'CoreOptions');
    expect(t).toBeDefined();
    const props = (t?.schema as { properties?: Record<string, unknown> })?.properties ?? {};
    expect(Object.keys(props).sort()).toEqual(['flush_interval', 'host', 'level']);
    expect((props.host as { description?: string })?.description).toBe('Base host');
  });

  test('Omit on external base subtracts keys unless re-declared', async () => {
    const { spec } = await extract({ entryFile: path.join(appDir, 'src/index.ts') });

    // Key omitted and NOT re-declared must be absent from the flatten.
    const app = spec.exports.find((e) => e.name === 'AppOptions');
    expect(app).toBeDefined();
    const appMembers = app?.members?.map((m) => m.name).sort();
    expect(appMembers).toEqual(['app_name', 'host', 'level']);

    // Omitted keys stay out; a re-declared key survives via the literal only.
    const strict = spec.exports.find((e) => e.name === 'StrictOptions');
    expect(strict).toBeDefined();
    const strictMembers = strict?.members?.map((m) => m.name).sort();
    expect(strictMembers).toEqual(['flush_interval', 'level', 'strict']);

    const allOf = (strict?.schema as { allOf?: { properties?: Record<string, unknown> }[] })?.allOf;
    expect(allOf).toBeDefined();
    const basePart = allOf?.[0]?.properties ?? {};
    expect(Object.keys(basePart).sort()).toEqual(['level']);
  });

  test('checker-erased aliases register by name (alias-to-any, indexed-access union)', async () => {
    const { spec } = await extract({ entryFile: path.join(appDir, 'src/index.ts') });
    expect(spec.types?.find((t) => t.name === 'AnyEvent')).toBeDefined();
    const level = spec.types?.find((t) => t.name === 'CoreLevel');
    expect(level).toBeDefined();
    expect(JSON.stringify(level?.schema)).toContain('debug');
  });

  test('namespace-qualified reference registers the namespace type exports', async () => {
    const { spec } = await extract({ entryFile: path.join(appDir, 'src/index.ts') });
    for (const name of ['ErrorBuilder', 'TrackedError', 'ErrorCoercer']) {
      expect(spec.types?.map((t) => t.name)).toContain(name);
    }
  });

  test('exported names are not duplicated into types[]', async () => {
    const { spec } = await extract({ entryFile: path.join(appDir, 'src/index.ts') });
    const appEntries = spec.types?.filter((t) => t.name === 'App') ?? [];
    expect(appEntries.length).toBe(0);
  });

  test('followExternal: false disables the expansion pass', async () => {
    const { spec } = await extract({
      entryFile: path.join(appDir, 'src/index.ts'),
      followExternal: false,
    });
    expect(spec.types?.find((t) => t.name === 'ErrorBuilder')).toBeUndefined();
  });
});
