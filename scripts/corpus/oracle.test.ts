import { describe, expect, test } from 'bun:test';
import type { OpenPkg, SpecExport } from '@openpkg-ts/spec';
import { extract } from '../../packages/sdk/src/index.ts';
import { auditSpec } from './oracle.ts';

const emptySpec = (exports: SpecExport[]): OpenPkg => ({
  openpkg: '0.4.0',
  meta: { name: 'fixture' },
  exports,
});

describe('corpus oracle', () => {
  test('clean extract of a simple file has no coverage/kind findings', async () => {
    const code = `
      /** Add two numbers. */
      export function add(a: number, b = 1): number { return a + b; }
      export class Box<T> { constructor(public value: T) {} }
    `;
    const { spec } = await extract({ entryFile: 'clean.ts', content: code });
    const result = auditSpec({ spec, entryFile: 'clean.ts', content: code });
    expect(result.findings.filter((f) => f.axis === 'coverage')).toEqual([]);
    expect(result.findings.filter((f) => f.axis === 'kind')).toEqual([]);
    expect(result.findings.filter((f) => f.fingerprint === 'defaults/param-initializer')).toEqual([]);
    expect(result.scores.robustness).toBe(1);
  });

  test('flags a missing export', () => {
    const code = `export function keep(): void {}
export function drop(): void {}`;
    const spec = emptySpec([
      { id: 'keep', name: 'keep', kind: 'function', signatures: [{ returns: { schema: { type: 'null', 'x-ts-type': 'void' } } }] },
    ]);
    const result = auditSpec({ spec, entryFile: 'miss.ts', content: code });
    expect(result.findings.some((f) => f.fingerprint === 'coverage/missing' && f.export === 'drop')).toBe(
      true,
    );
  });

  test('flags callable const stored as variable without signatures', () => {
    const code = `
      export interface IProduce {
        <T>(base: T, recipe: (draft: T) => void): T;
      }
      const impl = <T>(base: T, _recipe: (draft: T) => void): T => base;
      export const produce: IProduce = impl;
    `;
    const spec = emptySpec([{ id: 'produce', name: 'produce', kind: 'variable', schema: { type: 'object' } }]);
    const result = auditSpec({ spec, entryFile: 'produce.ts', content: code });
    expect(result.findings.some((f) => f.fingerprint === 'kind/callable-const')).toBe(true);
    expect(result.findings.some((f) => f.fingerprint === 'signatures/overload-drop')).toBe(true);
  });

  test('flags empty generic return', () => {
    const code = `
      export class LiveMap<V = unknown> { get(_k: string): V | undefined { return undefined; } }
      export function useMap<V>(key: string): LiveMap<string, V> { return new LiveMap(); }
    `;
    const spec = emptySpec([
      { id: 'LiveMap', name: 'LiveMap', kind: 'class' },
      {
        id: 'useMap',
        name: 'useMap',
        kind: 'function',
        signatures: [{ parameters: [{ name: 'key', schema: { type: 'string' } }], returns: { schema: {} } }],
      },
    ]);
    const result = auditSpec({ spec, entryFile: 'livemap.ts', content: code });
    expect(
      result.findings.some(
        (f) =>
          f.export === 'useMap' &&
          (f.fingerprint === 'signatures/empty-return' ||
            f.fingerprint === 'signatures/generic-arity' ||
            f.fingerprint === 'roundtrip/generic-arity'),
      ),
    ).toBe(true);
  });

  test('flags Readonly<T> collapsing to object', () => {
    const code = `
      export class LiveObject<T extends object> {
        toImmutable(): Readonly<T> { return this as unknown as Readonly<T>; }
      }
    `;
    const spec = emptySpec([
      {
        id: 'LiveObject',
        name: 'LiveObject',
        kind: 'class',
        members: [
          {
            name: 'toImmutable',
            signatures: [{ returns: { schema: { type: 'object' } } }],
          },
        ],
        signatures: [{ returns: { schema: { type: 'object' } } }],
      },
    ]);
    const result = auditSpec({ spec, entryFile: 'readonly.ts', content: code });
    const hits = result.findings.filter(
      (f) =>
        f.fingerprint === 'roundtrip/utility-over-typeparam' ||
        f.fingerprint === 'members/missing-public',
    );
    expect(hits.length).toBeGreaterThan(0);
  });

  test('flags missing parameter initializer', () => {
    const code = `export function search(query: string, limit = 10): void {}`;
    const spec = emptySpec([
      {
        id: 'search',
        name: 'search',
        kind: 'function',
        signatures: [
          {
            parameters: [
              { name: 'query', schema: { type: 'string' } },
              { name: 'limit', required: false, schema: { type: 'number' } },
            ],
            returns: { schema: { type: 'null', 'x-ts-type': 'void' } },
          },
        ],
      },
    ]);
    const result = auditSpec({ spec, entryFile: 'defaults.ts', content: code });
    expect(result.findings.some((f) => f.fingerprint === 'defaults/param-initializer')).toBe(true);
  });

  test('flags named re-export through export * as coverage', async () => {
    // Single-file alias: export { freeze as frozen } still looks like export-as
    // if the original name is missing from the spec.
    const code = `
      export function freeze<T>(v: T): T { return v; }
      export { freeze as frozen };
    `;
    const { spec } = await extract({ entryFile: 'reexport.ts', content: code });
    const stripped: OpenPkg = {
      ...spec,
      exports: spec.exports.filter((e) => e.name !== 'frozen'),
    };
    const result = auditSpec({ spec: stripped, entryFile: 'reexport.ts', content: code });
    expect(result.findings.some((f) => f.export === 'frozen' && f.axis === 'coverage')).toBe(true);
  });
});
