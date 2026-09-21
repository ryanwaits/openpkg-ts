import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { extract } from './spec-builder';

/**
 * hono's entry: `import { Hono } from './hono'` then `export { Hono }`. In an
 * ESM package the extensionless specifier does not resolve under NodeNext, so
 * the checker aliases the export to its unknown symbol.
 */
describe('import then export of a local binding', () => {
  let dir: string;
  let entry: string;

  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'openpkg-local-reexport-'));
    fs.writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify({ name: 'pkg', type: 'module' }),
    );
    fs.writeFileSync(
      path.join(dir, 'hono.ts'),
      '/** The app. */\nexport class Hono<E = object> { env?: E; fetch(): void {} }\nexport const version = "1";\n',
    );
    entry = path.join(dir, 'index.ts');
    fs.writeFileSync(
      entry,
      "import { Hono, version as v } from './hono'\nexport { Hono, v as version }\n",
    );
  });

  afterAll(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('resolves through the import to the declaration', async () => {
    const { spec, verification } = await extract({ entryFile: entry });

    expect(verification?.details.skipped).toEqual([]);
    const hono = spec.exports.find((e) => e.name === 'Hono');
    expect(hono).toMatchObject({ kind: 'class', description: 'The app.' });
    expect(hono?.members?.map((m) => m.name).sort()).toEqual(['env', 'fetch']);
    expect(spec.exports.find((e) => e.name === 'version')?.kind).toBe('variable');
  });
});
