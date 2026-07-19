import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { SpecSchema, SpecType } from '@openpkg-ts/spec';
import { extract } from './spec-builder';

/**
 * Repro for a round-2 dogfood bug: a wide (>100-member) interface
 * in one workspace package, consumed in a sibling package as
 * `Omit<Iface, 'k'> & { k: NewSig, extra?: boolean }`.
 *
 * Before the fix, buildObjectSchemaFromProperties sliced properties to
 * maxProperties (default 100) BEFORE filtering, so:
 * - the intersection's object-literal branch (whose members the checker appends
 *   LAST in getProperties() order) fell past the cutoff and vanished, and
 * - underscore-prefixed members inside the window consumed budget, then got
 *   filtered, silently dropping trailing real members (130 → 97).
 * Underscore-prefixed members were also dropped everywhere in schema paths
 * while the export serializers kept them, so the same name resolved to
 * different shapes in exports[] vs types[].
 */

const MEMBER_COUNT = 130;

let workspaceRoot: string;
let browserDir: string;

function coreMemberNames(): string[] {
  const names: string[] = ['loaded', '__internal_flag', '_onEvent'];
  for (let i = names.length; i < MEMBER_COUNT; i++) names.push(`option_${i}`);
  return names;
}

beforeAll(() => {
  workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'openpkg-wide-'));
  browserDir = path.join(workspaceRoot, 'packages/browser');
  const coreDir = path.join(workspaceRoot, 'packages/core');

  fs.writeFileSync(
    path.join(workspaceRoot, 'pnpm-workspace.yaml'),
    "packages:\n  - 'packages/*'\n",
  );

  const members = coreMemberNames()
    .map((name) => {
      if (name === 'loaded') return '  loaded: (config: WideConfig) => void;';
      return `  ${name}?: string;`;
    })
    .join('\n');
  fs.mkdirSync(path.join(coreDir, 'src'), { recursive: true });
  fs.writeFileSync(
    path.join(coreDir, 'package.json'),
    JSON.stringify({ name: '@acme/core', version: '1.0.0', types: './dist/index.d.ts' }),
  );
  fs.writeFileSync(
    path.join(coreDir, 'src/index.ts'),
    `export interface WideConfig {\n${members}\n}\n`,
  );

  fs.mkdirSync(path.join(browserDir, 'src'), { recursive: true });
  fs.writeFileSync(
    path.join(browserDir, 'package.json'),
    JSON.stringify({
      name: '@acme/browser',
      version: '1.0.0',
      dependencies: { '@acme/core': 'workspace:^' },
    }),
  );
  // Client references Partial<WideConfig> and is exported BEFORE the alias so
  // WideConfig enters the registry from the early-reference path first.
  fs.writeFileSync(
    path.join(browserDir, 'src/index.ts'),
    [
      "import type { WideConfig } from '@acme/core';",
      'export class Client {',
      '  config!: Partial<WideConfig>;',
      '  set_config(partial: Partial<WideConfig>): void {}',
      '}',
      "export type BrowserConfig = Omit<WideConfig, 'loaded'> & {",
      '  loaded: (client: Client) => void;',
      '  extra?: boolean;',
      '};',
    ].join('\n'),
  );

  fs.mkdirSync(path.join(workspaceRoot, 'node_modules/@acme'), { recursive: true });
  fs.symlinkSync(
    path.join(workspaceRoot, 'packages/core'),
    path.join(workspaceRoot, 'node_modules/@acme/core'),
  );
});

afterAll(() => {
  fs.rmSync(workspaceRoot, { recursive: true, force: true });
});

/** Union of property names across a schema's inline object / allOf branches. */
function flattenedPropNames(schema: SpecSchema | undefined): Set<string> {
  const names = new Set<string>();
  if (!schema || typeof schema !== 'object') return names;
  const record = schema as Record<string, unknown>;
  const collect = (obj: unknown) => {
    const props = (obj as { properties?: Record<string, unknown> })?.properties;
    if (props) for (const key of Object.keys(props)) names.add(key);
  };
  collect(record);
  if (Array.isArray(record.allOf)) for (const branch of record.allOf) collect(branch);
  return names;
}

function typePropCount(t: SpecType): number {
  return flattenedPropNames(t.schema as SpecSchema).size;
}

describe('wide interface + Omit-intersection flatten across workspace packages', () => {
  test('flatten keeps every base member, the re-declared key, and the literal extras', async () => {
    const { spec } = await extract({ entryFile: path.join(browserDir, 'src/index.ts') });

    const alias = spec.exports.find((e) => e.name === 'BrowserConfig');
    expect(alias?.kind).toBe('type');

    const flat = flattenedPropNames(alias?.schema as SpecSchema);
    // Omit removes 'loaded' (129 left), literal re-adds it plus 'extra'
    expect(flat.size).toBe(MEMBER_COUNT + 1);
    expect(flat.has('loaded')).toBe(true);
    expect(flat.has('extra')).toBe(true);
    // Underscore-prefixed members are real API surface
    expect(flat.has('__internal_flag')).toBe(true);
    expect(flat.has('_onEvent')).toBe(true);
    // Members from the tail of the source interface survive
    expect(flat.has(`option_${MEMBER_COUNT - 1}`)).toBe(true);

    // The re-declared 'loaded' carries the literal branch's signature:
    // its parameter refs Client, not WideConfig
    const allOf = (alias?.schema as { allOf?: Record<string, unknown>[] })?.allOf ?? [];
    const literalBranch = allOf.find((b) => (b.properties as Record<string, unknown>)?.loaded) as {
      properties: Record<string, SpecSchema>;
    };
    expect(literalBranch).toBeDefined();
    expect(JSON.stringify(literalBranch.properties.loaded)).toContain('#/types/Client');
    expect(JSON.stringify(literalBranch.properties.loaded)).not.toContain('#/types/WideConfig');
  });

  test('early Partial<Iface> reference does not register a truncated snapshot', async () => {
    const { spec } = await extract({ entryFile: path.join(browserDir, 'src/index.ts') });

    const entries = (spec.types ?? []).filter((t) => t.name === 'WideConfig');
    expect(entries.length).toBe(1);
    expect(typePropCount(entries[0])).toBe(MEMBER_COUNT);

    const flat = flattenedPropNames(entries[0].schema as SpecSchema);
    expect(flat.has('loaded')).toBe(true);
    expect(flat.has('__internal_flag')).toBe(true);
    expect(flat.has(`option_${MEMBER_COUNT - 1}`)).toBe(true);
  });

  test('no name appears in the spec with conflicting member counts', async () => {
    const { spec } = await extract({ entryFile: path.join(browserDir, 'src/index.ts') });

    const countsByName = new Map<string, Set<number>>();
    for (const t of spec.types ?? []) {
      const counts = countsByName.get(t.name) ?? new Set<number>();
      counts.add(typePropCount(t));
      countsByName.set(t.name, counts);
    }
    for (const exp of spec.exports) {
      const flat = flattenedPropNames(exp.schema as SpecSchema);
      if (flat.size === 0) continue;
      const counts = countsByName.get(exp.name);
      // An export and its types[] entry must agree on shape
      if (counts) counts.add(flat.size);
    }

    for (const [name, counts] of countsByName) {
      expect({ name, distinctCounts: counts.size }).toEqual({ name, distinctCounts: 1 });
    }
  });
});
