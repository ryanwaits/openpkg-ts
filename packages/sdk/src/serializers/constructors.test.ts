import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { SpecExport } from '@openpkg-ts/spec';
import { extract } from '../builder/spec-builder';

function byName(exports: SpecExport[], name: string): SpecExport | undefined {
  return exports.find((e) => e.name === name);
}

describe('constructor JSDoc tags', () => {
  test('own constructor signature keeps tags and examples', async () => {
    const code = `
      /** Options for {@link Client}. */
      export interface ClientOptions {
        /** Host to connect to. */
        host?: string;
      }

      /** A minimal API client. */
      export class Client {
        /**
         * Create a new client.
         *
         * @param options - Connection options.
         *
         * @remarks
         * The constructor validates options eagerly and never throws asynchronously.
         *
         * @example
         * \`\`\`ts
         * const client = new Client({ host: 'example.com' })
         * \`\`\`
         */
        constructor(options?: ClientOptions) {
          void options;
        }
      }
    `;

    const { spec } = await extract({ entryFile: 'test.ts', content: code });
    const sig = byName(spec.exports, 'Client')?.signatures?.[0];

    expect(sig).toBeDefined();
    expect(sig?.description).toBe('Create a new client.');
    expect(sig?.tags?.map((t) => t.name)).toEqual(['param', 'remarks', 'example']);
    expect(sig?.tags?.find((t) => t.name === 'remarks')?.text).toContain(
      'validates options eagerly',
    );
    expect(sig?.examples).toHaveLength(1);
    expect(sig?.inheritedFrom).toBeUndefined();
  });
});

describe('inherited constructors', () => {
  const baseAndClient = `
    /** Shared base client. */
    export class BaseClient {
      /**
       * Create a client.
       *
       * @param name - Instance name.
       * @param flushAt - Batch size before flushing.
       *
       * @example
       * \`\`\`ts
       * const c = new Client('svc', 20)
       * \`\`\`
       */
      constructor(name: string, flushAt?: number) {
        void name;
        void flushAt;
      }

      /** Flush pending work. */
      flush(): void {}
    }

    /** Concrete client without its own constructor. */
    export class Client extends BaseClient {
      /** Send one item. */
      send(item: string): void {
        void item;
      }
    }
  `;

  test('subclass without own constructor surfaces base constructor signature', async () => {
    const { spec } = await extract({ entryFile: 'test.ts', content: baseAndClient });
    const sig = byName(spec.exports, 'Client')?.signatures?.[0];

    expect(sig).toBeDefined();
    expect(sig?.inheritedFrom).toBe('BaseClient');
    expect(sig?.description).toBe('Create a client.');
    expect(sig?.parameters?.map((p) => p.name)).toEqual(['name', 'flushAt']);
    expect(sig?.parameters?.[0]?.description).toBe('Instance name.');
    expect(sig?.tags?.map((t) => t.name)).toEqual(['param', 'param', 'example']);
    expect(sig?.examples).toHaveLength(1);
  });

  test('base class export itself is unchanged', async () => {
    const { spec } = await extract({ entryFile: 'test.ts', content: baseAndClient });
    const sig = byName(spec.exports, 'BaseClient')?.signatures?.[0];

    expect(sig).toBeDefined();
    expect(sig?.inheritedFrom).toBeUndefined();
  });

  test('subclass with its own constructor is unchanged (no inherited signature added)', async () => {
    const code = `
      export class Base {
        /** Base ctor. */
        constructor(a: string) { void a; }
      }
      export class Derived extends Base {
        /** Derived ctor. */
        constructor(b: number) { super(String(b)); }
      }
    `;

    const { spec } = await extract({ entryFile: 'test.ts', content: code });
    const sigs = byName(spec.exports, 'Derived')?.signatures;

    expect(sigs).toHaveLength(1);
    expect(sigs?.[0]?.description).toBe('Derived ctor.');
    expect(sigs?.[0]?.parameters?.map((p) => p.name)).toEqual(['b']);
    expect(sigs?.[0]?.inheritedFrom).toBeUndefined();
  });

  test('default synthesized constructor stays unserialized (no ctor anywhere in chain)', async () => {
    const code = `
      export class Base {
        run(): void {}
      }
      export class Derived extends Base {}
    `;

    const { spec } = await extract({ entryFile: 'test.ts', content: code });

    expect(byName(spec.exports, 'Base')?.signatures).toBeUndefined();
    expect(byName(spec.exports, 'Derived')?.signatures).toBeUndefined();
  });

  test('constructor inherited across a two-level chain reports the declaring class', async () => {
    const code = `
      export class Root {
        /** Root ctor. */
        constructor(id: string) { void id; }
      }
      export class Middle extends Root {}
      export class Leaf extends Middle {}
    `;

    const { spec } = await extract({ entryFile: 'test.ts', content: code });
    const sig = byName(spec.exports, 'Leaf')?.signatures?.[0];

    expect(sig).toBeDefined();
    expect(sig?.inheritedFrom).toBe('Root');
    expect(sig?.parameters?.map((p) => p.name)).toEqual(['id']);
  });

  test('base constructor overloads are all surfaced with overload indices', async () => {
    const code = `
      export class Base {
        /** From string. */
        constructor(value: string);
        /** From number. */
        constructor(value: number);
        constructor(value: string | number) { void value; }
      }
      export class Derived extends Base {}
    `;

    const { spec } = await extract({ entryFile: 'test.ts', content: code });
    const sigs = byName(spec.exports, 'Derived')?.signatures;

    expect(sigs?.length).toBeGreaterThanOrEqual(2);
    for (const sig of sigs ?? []) {
      expect(sig.inheritedFrom).toBe('Base');
    }
    expect(sigs?.map((s) => s.overloadIndex)).toEqual(sigs?.map((_, i) => i));
  });
});

describe('inherited constructors across workspace packages', () => {
  let workspaceRoot: string;
  let clientDir: string;

  beforeAll(() => {
    workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'openpkg-ctor-ws-'));
    const baseDir = path.join(workspaceRoot, 'packages/base');
    clientDir = path.join(workspaceRoot, 'packages/client');

    fs.mkdirSync(path.join(baseDir, 'src'), { recursive: true });
    fs.writeFileSync(
      path.join(baseDir, 'package.json'),
      JSON.stringify({
        name: '@repro/base',
        version: '1.0.0',
        main: './src/index.ts',
        types: './src/index.ts',
      }),
    );
    fs.writeFileSync(
      path.join(baseDir, 'src/index.ts'),
      [
        '/** Shared base client. */',
        'export class BaseClient {',
        '  /**',
        '   * Create a client.',
        '   *',
        '   * @param name - Instance name.',
        '   * @param flushAt - Batch size before flushing.',
        '   *',
        '   * @example',
        '   * ```ts',
        "   * const c = new Client('svc', 20)",
        '   * ```',
        '   */',
        '  constructor(name: string, flushAt?: number) {',
        '    void name;',
        '    void flushAt;',
        '  }',
        '',
        '  /** Flush pending work. */',
        '  flush(): void {}',
        '}',
      ].join('\n'),
    );

    fs.mkdirSync(path.join(clientDir, 'src'), { recursive: true });
    fs.writeFileSync(
      path.join(clientDir, 'package.json'),
      JSON.stringify({
        name: '@repro/client',
        version: '1.0.0',
        dependencies: { '@repro/base': 'workspace:*' },
      }),
    );
    fs.writeFileSync(
      path.join(clientDir, 'src/index.ts'),
      [
        "import { BaseClient } from '@repro/base';",
        '',
        '/** Concrete client without its own constructor. */',
        'export class Client extends BaseClient {',
        '  /** Send one item. */',
        '  send(item: string): void {',
        '    void item;',
        '  }',
        '}',
      ].join('\n'),
    );

    // workspace symlink
    fs.mkdirSync(path.join(workspaceRoot, 'node_modules/@repro'), { recursive: true });
    fs.symlinkSync(
      path.join(workspaceRoot, 'packages/base'),
      path.join(workspaceRoot, 'node_modules/@repro/base'),
    );
  });

  afterAll(() => {
    fs.rmSync(workspaceRoot, { recursive: true, force: true });
  });

  test('subclass surfaces constructor declared in a sibling workspace package', async () => {
    const { spec } = await extract({
      entryFile: path.join(clientDir, 'src/index.ts'),
    });

    const sig = byName(spec.exports, 'Client')?.signatures?.[0];

    expect(sig).toBeDefined();
    expect(sig?.inheritedFrom).toBe('BaseClient');
    expect(sig?.description).toBe('Create a client.');
    expect(sig?.parameters?.map((p) => p.name)).toEqual(['name', 'flushAt']);
    expect(sig?.tags?.map((t) => t.name)).toEqual(['param', 'param', 'example']);
    expect(sig?.examples).toHaveLength(1);
  });
});
