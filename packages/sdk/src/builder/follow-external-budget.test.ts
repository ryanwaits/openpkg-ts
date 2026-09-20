import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { extract } from './spec-builder';

/**
 * followExternal: true used to OOM on packages with large generic method
 * graphs (zod). Expansion must register the named type without walking
 * every method instantiation.
 */

function findPkg(name: string): string {
  let dir = import.meta.dir;
  while (true) {
    const cand = path.join(dir, 'node_modules', name);
    if (fs.existsSync(path.join(cand, 'package.json'))) return cand;
    const parent = path.dirname(dir);
    if (parent === dir) throw new Error(`cannot find ${name}`);
    dir = parent;
  }
}

describe('followExternal expansion is bounded', () => {
  let dir: string;
  let fatEntry: string;
  let zodEntry: string;

  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'openpkg-follow-budget-'));

    const fatPkg = path.join(dir, 'node_modules/fat-ext');
    fs.mkdirSync(fatPkg, { recursive: true });
    fs.writeFileSync(
      path.join(fatPkg, 'package.json'),
      JSON.stringify({ name: 'fat-ext', types: 'index.d.ts' }),
    );
    const methods = Array.from({ length: 80 }, (_, i) => `  m${i}(): Fat;`).join('\n');
    fs.writeFileSync(
      path.join(fatPkg, 'index.d.ts'),
      `export declare class Fat {\n${methods}\n  value: string;\n}\n`,
    );
    fatEntry = path.join(dir, 'fat.ts');
    fs.writeFileSync(
      fatEntry,
      "import type { Fat } from 'fat-ext';\nexport function use(f: Fat): string { return f.value; }\n",
    );

    const zodSrc = findPkg('zod');
    fs.mkdirSync(path.join(dir, 'node_modules'), { recursive: true });
    fs.symlinkSync(zodSrc, path.join(dir, 'node_modules/zod'));
    fs.writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify({ name: 'budget', type: 'module' }),
    );
    zodEntry = path.join(dir, 'schema.ts');
    fs.writeFileSync(
      zodEntry,
      [
        "import { z } from 'zod';",
        'export const schema: z.ZodObject<{ name: z.ZodString }> = z.object({ name: z.string() });',
      ].join('\n'),
    );
  });

  afterAll(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('followExternal: true expands a fat class without method fan-out', async () => {
    const { spec } = await extract({ entryFile: fatEntry, followExternal: true });
    const fat = spec.types?.find((t) => t.name === 'Fat');
    expect(fat).toBeDefined();
    const props = (fat?.schema as { properties?: Record<string, unknown> } | undefined)?.properties;
    expect(props?.value).toEqual({ type: 'string' });
    expect((spec.types ?? []).length).toBeLessThan(50);
  });

  test('followExternal: ["zod"] on a schema export stays bounded', async () => {
    const t = Date.now();
    const { spec } = await extract({ entryFile: zodEntry, followExternal: ['zod'] });
    expect(Date.now() - t).toBeLessThan(10_000);
    expect(spec.exports).toHaveLength(1);
    expect((spec.types ?? []).length).toBeLessThan(500);
  });
});
