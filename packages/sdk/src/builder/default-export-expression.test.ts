import { describe, expect, test } from 'bun:test';
import type { SpecExport } from '@openpkg-ts/spec';
import { extract } from './spec-builder';

type ObjectSchema = { type?: string; properties?: Record<string, unknown> };

async function defaultOf(code: string): Promise<SpecExport | undefined> {
  const result = await extract({ entryFile: 'test.ts', content: code });
  expect(result.verification?.details.skipped ?? []).toEqual([]);
  return result.spec.exports.find((e) => e.name === 'default');
}

/** `export default <expression>`: the export assignment is the only declaration. */
describe('expression default exports', () => {
  test('arrow function', async () => {
    const exp = await defaultOf(`export default (a: number, b?: string) => a;`);

    expect(exp).toMatchObject({ id: 'default', name: 'default', kind: 'function' });
    expect(exp?.signatures?.[0]?.parameters).toMatchObject([
      { name: 'a', required: true, schema: { type: 'number' } },
      { name: 'b', required: false },
    ]);
    expect(exp?.signatures?.[0]?.returns?.schema).toEqual({ type: 'number' });
    expect(exp && 'localName' in exp).toBe(false);
  });

  test('parenthesized function expression', async () => {
    const exp = await defaultOf(`export default (async function (key: string) { return key; });`);

    expect(exp).toMatchObject({ name: 'default', kind: 'function', flags: { async: true } });
    expect(exp?.signatures?.[0]?.parameters?.[0]).toMatchObject({ name: 'key', required: true });
  });

  test('object literal', async () => {
    const exp = await defaultOf(`export default { a: 1, b: 'two' };`);

    expect(exp).toMatchObject({ name: 'default', kind: 'variable' });
    expect(Object.keys((exp?.schema as ObjectSchema).properties ?? {})).toEqual(['a', 'b']);
    expect(exp && 'localName' in exp).toBe(false);
  });

  test('primitive literal', async () => {
    const exp = await defaultOf(`export default 42;`);

    expect(exp).toMatchObject({ name: 'default', kind: 'variable' });
    expect(exp?.schema).toMatchObject({ type: 'number' });
  });

  test('call expression is typed by the checker', async () => {
    const exp = await defaultOf(
      `interface Config { port: number; host?: string }
       declare function defineConfig(config: Config): Config;
       export default defineConfig({ port: 3000 });`,
    );

    expect(exp).toMatchObject({ name: 'default', kind: 'variable' });
    expect(exp?.schema).toEqual({ $ref: '#/types/Config' });
  });

  test('call expression returning a function is a function', async () => {
    const exp = await defaultOf(
      `declare function wrap<T>(fn: T): T;
       export default wrap((key: string): number => key.length);`,
    );

    expect(exp).toMatchObject({ name: 'default', kind: 'function' });
    expect(exp?.signatures?.[0]?.parameters?.[0]).toMatchObject({ name: 'key', required: true });
  });

  test('satisfies / as keep the asserted type and the function kind', async () => {
    const obj = await defaultOf(`export default { a: 1 } as { a: number; b?: string };`);
    expect(Object.keys((obj?.schema as ObjectSchema).properties ?? {})).toEqual(['a', 'b']);

    const fn = await defaultOf(
      `export default ((a: number) => a) satisfies (a: number) => number;`,
    );
    expect(fn).toMatchObject({ kind: 'function' });
    expect(fn?.signatures?.[0]?.parameters?.[0]).toMatchObject({ name: 'a' });
  });

  test('docs come from the export statement', async () => {
    const exp = await defaultOf(
      `/**\n * Adds one.\n * @deprecated use inc\n */\nexport default (a: number) => a + 1;`,
    );

    expect(exp?.description).toBe('Adds one.');
    expect(exp?.deprecated).toBe(true);
  });
});
