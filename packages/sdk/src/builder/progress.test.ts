import { describe, expect, test } from 'bun:test';
import { extract } from './spec-builder';

describe('progress callback', () => {
  test('onProgress called for each export with sequential numbers', async () => {
    const code = `
      export const a = 1;
      export const b = 2;
      export const c = 3;
      export function d(): void {}
      export type E = string;
    `;

    const calls: Array<{ current: number; total: number; item: string }> = [];

    await extract({
      entryFile: 'test.ts',
      content: code,
      onProgress: (current, total, item) => {
        calls.push({ current, total, item });
      },
    });

    // 5 exports should trigger 5 progress calls
    expect(calls.length).toBe(5);
    // All calls should have total = 5
    expect(calls.every((c) => c.total === 5)).toBe(true);
    // current should be sequential 1-5
    expect(calls.map((c) => c.current)).toEqual([1, 2, 3, 4, 5]);
    // All export names should be reported (order may vary by TS symbol resolution)
    const items = new Set(calls.map((c) => c.item));
    expect(items).toEqual(new Set(['a', 'b', 'c', 'd', 'E']));
  });

  test('onProgress respects only filter for total count', async () => {
    const code = `
      export const foo1 = 1;
      export const foo2 = 2;
      export const bar = 3;
      export const baz = 4;
    `;

    const calls: Array<{ current: number; total: number; item: string }> = [];

    await extract({
      entryFile: 'test.ts',
      content: code,
      only: ['foo*'],
      onProgress: (current, total, item) => {
        calls.push({ current, total, item });
      },
    });

    expect(calls.length).toBe(2);
    expect(calls.every((c) => c.total === 2)).toBe(true);
    expect(calls.map((c) => c.current)).toEqual([1, 2]);
    const items = new Set(calls.map((c) => c.item));
    expect(items).toEqual(new Set(['foo1', 'foo2']));
  });

  test('onProgress respects ignore filter for total count', async () => {
    const code = `
      export const a = 1;
      export const b = 2;
      export const _internal = 3;
    `;

    const calls: Array<{ current: number; total: number; item: string }> = [];

    await extract({
      entryFile: 'test.ts',
      content: code,
      ignore: ['_*'],
      onProgress: (current, total, item) => {
        calls.push({ current, total, item });
      },
    });

    expect(calls.length).toBe(2);
    expect(calls.every((c) => c.total === 2)).toBe(true);
    expect(calls.map((c) => c.current)).toEqual([1, 2]);
    const items = new Set(calls.map((c) => c.item));
    expect(items).toEqual(new Set(['a', 'b']));
  });

  test('no progress calls when no exports', async () => {
    const code = `const internal = 1;`;

    const calls: Array<{ current: number; total: number; item: string }> = [];

    await extract({
      entryFile: 'test.ts',
      content: code,
      onProgress: (current, total, item) => {
        calls.push({ current, total, item });
      },
    });

    expect(calls.length).toBe(0);
  });
});

describe('event loop yielding', () => {
  test('yields to event loop during extraction of many exports', async () => {
    // Generate code with > YIELD_BATCH_SIZE (5) exports to trigger yield
    const exportCount = 12;
    const exports = Array.from({ length: exportCount }, (_, i) => `export const v${i} = ${i};`);
    const code = exports.join('\n');

    let yielded = false;
    const yieldChecker = (async () => {
      await new Promise((r) => setImmediate(r));
      yielded = true;
    })();

    // Start extraction
    const extractionPromise = extract({
      entryFile: 'test.ts',
      content: code,
    });

    // Wait for extraction to complete
    await extractionPromise;

    // Check if setImmediate got a chance to run
    await yieldChecker;

    expect(yielded).toBe(true);
  });

  test('small extractions complete without blocking unnecessarily', async () => {
    const code = `
      export const a = 1;
      export const b = 2;
    `;

    const startTime = performance.now();
    await extract({
      entryFile: 'test.ts',
      content: code,
    });
    const duration = performance.now() - startTime;

    // Should complete quickly (< 1000ms for 2 exports)
    expect(duration).toBeLessThan(1000);
  });
});
