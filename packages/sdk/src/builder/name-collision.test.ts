import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { extract } from './spec-builder';

/**
 * Two different interfaces named `Logger` reachable in one build must NOT
 * shadow each other in the type registry (which was keyed by bare name). The
 * regression: the published `Logger` kept one interface's members and dropped
 * the other's, and refs pointing at the shadowed type resolved to the wrong one.
 */
describe('same-name type collision', () => {
  let dir: string;
  let entry: string;

  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'openpkg-collision-'));
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'consumer' }));
    fs.writeFileSync(
      path.join(dir, 'a.ts'),
      'interface Logger { debug(): void; info(): void; }\nexport function makeA(): Logger { return {} as Logger; }\n',
    );
    fs.writeFileSync(
      path.join(dir, 'b.ts'),
      'interface Logger { trace(): void; warn(): void; error(): void; fatal(): void; }\nexport function makeB(): Logger { return {} as Logger; }\n',
    );
    entry = path.join(dir, 'index.ts');
    fs.writeFileSync(entry, "export { makeA } from './a';\nexport { makeB } from './b';\n");
  });
  afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

  test('both Loggers register with their own members, neither shadows', async () => {
    const { spec } = await extract({ entryFile: entry });
    const loggers = (spec.types ?? []).filter((t) => t.name === 'Logger');
    expect(loggers.length).toBe(2);

    const membersOf = (id: string): string[] => {
      const t = loggers.find((x) => x.id === id);
      return Object.keys(((t?.schema ?? {}) as { properties?: object }).properties ?? {});
    };
    const byCount = [...loggers].sort(
      (a, b) =>
        Object.keys(((a.schema ?? {}) as { properties?: object }).properties ?? {}).length -
        Object.keys(((b.schema ?? {}) as { properties?: object }).properties ?? {}).length,
    );
    const small = membersOf(byCount[0].id);
    const big = membersOf(byCount[1].id);
    expect(small.sort()).toEqual(['debug', 'info']);
    expect(big.sort()).toEqual(['error', 'fatal', 'trace', 'warn']);
  });

  test('each function resolves to its own Logger (refs disambiguated)', async () => {
    const { spec } = await extract({ entryFile: entry });
    const refOf = (name: string): string =>
      (
        (spec.exports.find((e) => e.name === name)?.signatures?.[0]?.returns?.schema ?? {}) as {
          $ref?: string;
        }
      ).$ref ?? '';
    const a = refOf('makeA');
    const b = refOf('makeB');
    expect(a).not.toBe(b);
    // both refs resolve to a registered type id
    const ids = new Set((spec.types ?? []).map((t) => t.id));
    expect(ids.has(a.replace('#/types/', ''))).toBe(true);
    expect(ids.has(b.replace('#/types/', ''))).toBe(true);
  });

  test('a lone type keeps its bare id (no churn for the common case)', async () => {
    const solo = fs.mkdtempSync(path.join(os.tmpdir(), 'openpkg-solo-'));
    fs.writeFileSync(path.join(solo, 'package.json'), JSON.stringify({ name: 'solo' }));
    const soloEntry = path.join(solo, 'index.ts');
    fs.writeFileSync(
      soloEntry,
      'interface Logger { debug(): void; }\nexport function make(): Logger { return {} as Logger; }\n',
    );
    const { spec } = await extract({ entryFile: soloEntry });
    const logger = spec.types?.find((t) => t.name === 'Logger');
    expect(logger?.id).toBe('Logger');
    fs.rmSync(solo, { recursive: true, force: true });
  });
});

/**
 * File-private aliases sharing a name inside ONE package (valtio: `type Options`
 * in devtools.ts and react.ts). The second one resolved to `any` (its
 * intersection arm came from an unresolved module), so its `$ref` was emitted
 * by bare name and landed on the other file's `Options`.
 */
describe('same-name file-private aliases in one package', () => {
  let dir: string;

  type Schema = { $ref?: string; allOf?: Schema[]; properties?: Record<string, unknown> };

  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'openpkg-collision-file-'));
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'consumer' }));
    fs.writeFileSync(
      path.join(dir, 'react.ts'),
      'type Options = { sync?: boolean };\nexport function useSnap(o?: Options): void {}\n',
    );
    fs.writeFileSync(
      path.join(dir, 'devtools.ts'),
      "import type { Config } from 'missing-pkg';\ntype Options = { enabled?: boolean; name?: string } & Config;\nexport function devtools(o?: Options): void {}\n",
    );
    fs.writeFileSync(
      path.join(dir, 'third.ts'),
      'export type Options = { third: true };\nexport function third(o: Options): void {}\n',
    );
    fs.writeFileSync(
      path.join(dir, 'index.ts'),
      "export { useSnap } from './react';\nexport { devtools } from './devtools';\n",
    );
    fs.writeFileSync(
      path.join(dir, 'with-exported.ts'),
      "export { useSnap } from './react';\nexport { devtools } from './devtools';\nexport * from './third';\n",
    );
  });
  afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

  const paramRef = (spec: { exports: unknown[] }, name: string): string => {
    const exp = (
      spec.exports as Array<{
        name: string;
        signatures?: Array<{ parameters?: Array<{ schema?: Schema }> }>;
      }>
    ).find((e) => e.name === name);
    return exp?.signatures?.[0]?.parameters?.[0]?.schema?.$ref ?? '';
  };

  test('each ref resolves to its own declaration', async () => {
    const { spec } = await extract({ entryFile: path.join(dir, 'index.ts') });
    expect(paramRef(spec, 'useSnap')).toBe('#/types/Options');
    expect(paramRef(spec, 'devtools')).toBe('#/types/devtools.Options');

    const byId = new Map((spec.types ?? []).map((t) => [t.id, t]));
    const first = byId.get('Options')?.schema as Schema;
    expect(Object.keys(first.properties ?? {})).toEqual(['sync']);

    const second = byId.get('devtools.Options');
    expect(second?.name).toBe('Options');
    const arm = (second?.schema as Schema).allOf?.[0];
    expect(Object.keys(arm?.properties ?? {}).sort()).toEqual(['enabled', 'name']);
  });

  test('the exported declaration owns the bare name', async () => {
    const { spec } = await extract({ entryFile: path.join(dir, 'with-exported.ts') });
    expect(paramRef(spec, 'third')).toBe('#/types/Options');
    expect(paramRef(spec, 'useSnap')).toBe('#/types/react.Options');
    expect(paramRef(spec, 'devtools')).toBe('#/types/devtools.Options');

    const byId = new Map((spec.types ?? []).map((t) => [t.id, t]));
    expect(Object.keys((byId.get('Options')?.schema as Schema).properties ?? {})).toEqual([
      'third',
    ]);
    expect(Object.keys((byId.get('react.Options')?.schema as Schema).properties ?? {})).toEqual([
      'sync',
    ]);
    expect(byId.has('devtools.Options')).toBe(true);
  });

  test('a namespaced declaration is scoped by its namespace', async () => {
    const nsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openpkg-collision-ns-'));
    fs.writeFileSync(path.join(nsDir, 'package.json'), JSON.stringify({ name: 'ns' }));
    const nsEntry = path.join(nsDir, 'index.ts');
    fs.writeFileSync(
      nsEntry,
      [
        'declare namespace A { interface Props { a: string } }',
        'declare namespace B { interface Props { b: string } }',
        'export function a(p: A.Props): void {}',
        'export function b(p: B.Props): void {}',
      ].join('\n'),
    );
    const { spec } = await extract({ entryFile: nsEntry });
    expect(paramRef(spec, 'a')).toBe('#/types/Props');
    expect(paramRef(spec, 'b')).toBe('#/types/B.Props');
    fs.rmSync(nsDir, { recursive: true, force: true });
  });

  test('a renamed re-export does not take the name from its namesake export', async () => {
    const reDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openpkg-collision-rename-'));
    fs.writeFileSync(path.join(reDir, 'package.json'), JSON.stringify({ name: 're' }));
    fs.writeFileSync(path.join(reDir, 'core.ts'), 'export type output = { core: true };\n');
    fs.writeFileSync(path.join(reDir, 'api.ts'), 'export type output = { api: true };\n');
    const reEntry = path.join(reDir, 'index.ts');
    fs.writeFileSync(
      reEntry,
      [
        "import type { output as coreOutput } from './core';",
        "import type { output } from './api';",
        "export type { output as TypeOf } from './core';",
        "export type { output } from './api';",
        'export function viaCore(o: coreOutput): void {}',
        'export function viaApi(o: output): void {}',
      ].join('\n'),
    );
    const { spec } = await extract({ entryFile: reEntry });
    expect(paramRef(spec, 'viaApi')).toBe('#/types/output');
    expect(paramRef(spec, 'viaCore')).toBe('#/types/core.output');
    fs.rmSync(reDir, { recursive: true, force: true });
  });
});
