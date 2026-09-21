import { afterEach, describe, expect, test } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { SpecExport } from '@openpkg-ts/spec';
import { extract } from './spec-builder';

async function defaultOf(code: string): Promise<SpecExport | undefined> {
  const result = await extract({ entryFile: 'test.ts', content: code });
  return result.spec.exports.find((e) => e.name === 'default');
}

function write(file: string, content: string) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

describe('default export local name', () => {
  let tmp: string;

  afterEach(() => {
    if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
  });

  function writePackage(files: Record<string, string>): string {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'openpkg-default-name-'));
    write(path.join(tmp, 'package.json'), JSON.stringify({ name: 'pkg' }));
    write(
      path.join(tmp, 'tsconfig.json'),
      JSON.stringify({ compilerOptions: { module: 'ESNext', strict: true } }),
    );
    for (const [file, content] of Object.entries(files)) write(path.join(tmp, file), content);
    return path.join(tmp, 'src/index.ts');
  }

  test('export default function foo() {}', async () => {
    const exp = await defaultOf(`export default function foo(a: number): number { return a; }`);

    expect(exp).toMatchObject({ id: 'default', name: 'default', kind: 'function' });
    expect(exp?.localName).toBe('foo');
  });

  test('export default class Foo {}', async () => {
    const exp = await defaultOf(`export default class Foo { go(): void {} }`);

    expect(exp).toMatchObject({ name: 'default', kind: 'class', localName: 'Foo' });
  });

  test('export default foo', async () => {
    const exp = await defaultOf(`const foo = (a: number) => a;\nexport default foo;`);

    expect(exp).toMatchObject({ name: 'default', kind: 'function', localName: 'foo' });
  });

  test('export { foo as default }', async () => {
    const exp = await defaultOf(`function foo(): void {}\nexport { foo as default };`);

    expect(exp).toMatchObject({ name: 'default', kind: 'function', localName: 'foo' });
  });

  test('named exports carry no localName', async () => {
    const result = await extract({
      entryFile: 'test.ts',
      content: `function foo(): void {}\nexport { foo as bar, foo };`,
    });

    for (const exp of result.spec.exports) expect('localName' in exp).toBe(false);
  });

  test('anonymous defaults are named by their export and carry no localName', async () => {
    for (const [code, kind] of [
      [`export default function (): void {}`, 'function'],
      [`export default class { go(): void {} }`, 'class'],
    ]) {
      const exp = await defaultOf(code);
      expect(exp).toMatchObject({ id: 'default', name: 'default', kind });
      expect(exp && 'localName' in exp).toBe(false);
    }
  });

  /** swr's shape: a default imported and re-exported as default. */
  test('import x from "./x"; export default x keeps the declared name', async () => {
    const entryFile = writePackage({
      'src/use-thing.ts': `interface Hook { (key: string): number }
        declare function withArgs<T>(h: unknown): T;
        const useThing = withArgs<Hook>(null);
        export default useThing;`,
      'src/index.ts': `import useThing from "./use-thing";\nexport default useThing;`,
    });

    const result = await extract({ entryFile });
    const exp = result.spec.exports.find((e) => e.name === 'default');

    expect(exp).toMatchObject({ id: 'default', kind: 'function', localName: 'useThing' });
  });

  test('anonymous declaration falls back to the name it is exported under', async () => {
    const entryFile = writePackage({
      'src/impl.ts': `export default function (key: string): number { return key.length; }`,
      'src/index.ts': `import useThing from "./impl";\nexport default useThing;`,
    });

    const result = await extract({ entryFile });
    const exp = result.spec.exports.find((e) => e.name === 'default');

    expect(exp).toMatchObject({ kind: 'function', localName: 'useThing' });
  });

  test('export { default } from "./x" keeps the declared name', async () => {
    const entryFile = writePackage({
      'src/impl.ts': `export default function useThing(): void {}`,
      'src/index.ts': `export { default } from "./impl";`,
    });

    const result = await extract({ entryFile });
    const exp = result.spec.exports.find((e) => e.name === 'default');

    expect(exp?.localName).toBe('useThing');
  });
});
