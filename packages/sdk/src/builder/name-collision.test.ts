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
