import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { extract } from './spec-builder';

/**
 * Regression guard: registry property decoration (x-ts-type) works for types
 * living in a sibling package resolved through node_modules — union/ref props
 * all carry checker-rendered text and no machine-specific import() qualifiers
 * appear anywhere in the spec.
 */

let workspaceRoot: string;
let clientEntry: string;

beforeAll(() => {
  workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'openpkg-xpkg-'));

  const baseDir = path.join(workspaceRoot, 'packages/base');
  fs.mkdirSync(path.join(baseDir, 'src'), { recursive: true });
  fs.writeFileSync(
    path.join(baseDir, 'package.json'),
    JSON.stringify({ name: '@repro/base', version: '1.0.0', types: './src/index.ts' }),
  );
  fs.writeFileSync(
    path.join(baseDir, 'src/index.ts'),
    `/** A handler. */
export type Handler = (x: string) => void;

/** Settings living in a sibling package. */
export type Settings = {
  /** Union with explicit null. */
  mode?: 'fast' | 'slow' | null;
  /** Ref-or-array union. */
  on?: Handler | Handler[];
  /** Plain string. */
  label: string;
};
`,
  );

  const clientDir = path.join(workspaceRoot, 'packages/client');
  fs.mkdirSync(path.join(clientDir, 'src'), { recursive: true });
  fs.writeFileSync(
    path.join(clientDir, 'package.json'),
    JSON.stringify({
      name: '@repro/client',
      version: '1.0.0',
      dependencies: { '@repro/base': '1.0.0' },
    }),
  );
  fs.mkdirSync(path.join(clientDir, 'node_modules/@repro'), { recursive: true });
  fs.symlinkSync(baseDir, path.join(clientDir, 'node_modules/@repro/base'));

  clientEntry = path.join(clientDir, 'src/index.ts');
  fs.writeFileSync(
    clientEntry,
    `import type { Settings } from '@repro/base';

/** Client whose options reference a cross-package type. */
export class Client {
  configure(s: Settings): void {
    void s;
  }
}
`,
  );
});

afterAll(() => {
  fs.rmSync(workspaceRoot, { recursive: true, force: true });
});

describe('cross-package registry property decoration', () => {
  test('union/ref props on a node_modules type carry x-ts-type; no import() leaks', async () => {
    const result = await extract({ entryFile: clientEntry });
    const settings = result.spec.types?.find((t) => t.name === 'Settings');
    expect(settings).toBeDefined();

    const props = (settings?.schema as { properties?: Record<string, Record<string, unknown>> })
      ?.properties;
    expect(props?.mode?.['x-ts-type']).toBe('"fast" | "slow" | null');
    expect(props?.on?.['x-ts-type']).toBe('Handler | Handler[]');
    // Bare primitive stays undecorated per policy
    expect(props?.label?.['x-ts-type']).toBeUndefined();

    expect(JSON.stringify(result.spec)).not.toContain('import("');
  });
});
