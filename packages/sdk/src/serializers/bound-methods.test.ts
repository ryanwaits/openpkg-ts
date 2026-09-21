import { afterEach, describe, expect, test } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { extract } from '../builder/spec-builder';

const COUNTER = `export class Counter {
  /**
   * Add to the running total.
   *
   * @param amount - how much to add
   * @param label - optional label for the entry
   * @returns the new total
   */
  add(amount: number, label?: string): number {
    return amount + (label ? 1 : 0);
  }
}
`;

function write(file: string, content: string) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

describe('bound method exports', () => {
  let tmp: string;

  afterEach(() => {
    if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
  });

  /** immer's shape: `module` set alone, class behind an extensionless import. */
  function writePackage(exportLine: string): string {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'openpkg-bound-method-'));
    write(path.join(tmp, 'package.json'), JSON.stringify({ name: 'pkg' }));
    write(
      path.join(tmp, 'tsconfig.json'),
      JSON.stringify({ compilerOptions: { module: 'ES6', strict: true } }),
    );
    write(path.join(tmp, 'src/internal.ts'), COUNTER);
    const entry = path.join(tmp, 'src/index.ts');
    write(
      entry,
      `import { Counter } from "./internal";\nconst counter = new Counter();\n${exportLine}\n`,
    );
    return entry;
  }

  test('inst.method.bind(inst) is a function with the method signature and docs', async () => {
    const entryFile = writePackage('export const add = /* @__PURE__ */ counter.add.bind(counter);');

    const result = await extract({ entryFile });

    const fn = result.spec.exports.find((e) => e.name === 'add');
    expect(fn?.kind).toBe('function');
    expect(fn?.signatures).toHaveLength(1);

    const sig = fn?.signatures?.[0];
    expect(sig?.parameters).toEqual([
      {
        name: 'amount',
        schema: { type: 'number' },
        required: true,
        description: 'how much to add',
      },
      {
        name: 'label',
        schema: { type: 'string' },
        required: false,
        description: 'optional label for the entry',
      },
    ]);
    expect(sig?.returns?.schema).toEqual({ type: 'number' });
    expect(sig?.description).toBe('Add to the running total.');
    expect(sig?.tags?.map((t) => t.name)).toEqual(['param', 'param', 'returns']);
  });

  test('extra bound arguments do not report the unbound parameter list', async () => {
    const entryFile = writePackage('export const addOne = counter.add.bind(counter, 1);');

    const result = await extract({ entryFile });

    const fn = result.spec.exports.find((e) => e.name === 'addOne');
    expect(fn?.kind).toBe('function');
    const names = fn?.signatures?.flatMap((s) => s.parameters?.map((p) => p.name) ?? []);
    expect(names).not.toContain('amount');
    expect(fn?.signatures?.[0]?.returns?.schema).toEqual({ type: 'number' });
  });
});
