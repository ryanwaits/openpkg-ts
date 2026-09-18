import { afterAll, beforeAll, expect, test } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { extract } from './spec-builder';

/**
 * A stub's origin is the package a consumer can name in `followExternal`.
 * Platform globals (lib.dom / lib.es) have none. The `typescript` package's
 * own API is a real package that merely shares a directory with the lib files.
 */

let dir: string;

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'openpkg-origins-'));
  const pkg = path.join(dir, 'node_modules/typescript');
  fs.mkdirSync(path.join(pkg, 'lib'), { recursive: true });
  fs.writeFileSync(
    path.join(pkg, 'package.json'),
    JSON.stringify({ name: 'typescript', version: '5.0.0', types: 'lib/typescript.d.ts' }),
  );
  fs.writeFileSync(
    path.join(pkg, 'lib/typescript.d.ts'),
    'export interface Node { kind: number }\n',
  );
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'origins' }));
  fs.writeFileSync(
    path.join(dir, 'index.ts'),
    [
      "import type { Node } from 'typescript';",
      'export function visit(node: Node, signal: AbortSignal): void {}',
    ].join('\n'),
  );
});

afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

test('typescript API types carry their package; platform globals carry none', async () => {
  const { spec } = await extract({ entryFile: path.join(dir, 'index.ts') });
  const origin = (name: string) =>
    (spec.types?.find((t) => t.name === name)?.schema as Record<string, unknown> | undefined)?.[
      'x-ts-package'
    ];
  expect(spec.types?.find((t) => t.name === 'Node')?.external).toBe(true);
  expect(origin('Node')).toBe('typescript');
  expect(spec.types?.find((t) => t.name === 'AbortSignal')?.external).toBe(true);
  expect(origin('AbortSignal')).toBeUndefined();
});

// The report tells users to add the origin to followExternal, so naming it must work.
test('the typescript package expands when named in followExternal', async () => {
  const { spec } = await extract({
    entryFile: path.join(dir, 'index.ts'),
    followExternal: ['typescript'],
  });
  const node = spec.types?.find((t) => t.name === 'Node');
  const props = (node?.schema as Record<string, Record<string, unknown>> | undefined)?.properties;
  expect(props?.kind).toEqual({ type: 'number' });
  // Naming a package never makes platform globals followable.
  const abort = spec.types?.find((t) => t.name === 'AbortSignal');
  expect((abort?.schema as Record<string, unknown>)?.properties).toBeUndefined();
});
