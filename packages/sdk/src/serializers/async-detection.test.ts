import { describe, expect, test } from 'bun:test';
import { extract } from '../builder/spec-builder';

describe('async function detection', () => {
  test('async function export has flags.async = true', async () => {
    // extract() can be slow on first run (TypeScript compiler init)
    const code = `
      export async function fetchUser(id: string): Promise<{ name: string }> {
        return { name: 'test' };
      }
    `;

    const result = await extract({ entryFile: 'test.ts', content: code });
    const exp = result.spec.exports.find((e) => e.name === 'fetchUser');

    expect(exp).toBeDefined();
    expect(exp?.kind).toBe('function');
    expect(exp?.flags?.async).toBe(true);
  });

  test('sync function export does not have flags.async', async () => {
    const code = `
      export function add(a: number, b: number): number {
        return a + b;
      }
    `;

    const result = await extract({ entryFile: 'test.ts', content: code });
    const exp = result.spec.exports.find((e) => e.name === 'add');

    expect(exp).toBeDefined();
    expect(exp?.flags?.async).toBeUndefined();
  });

  test('async arrow function export has flags.async = true', async () => {
    const code = `
      export const fetchData = async (url: string): Promise<string> => {
        return '';
      };
    `;

    const result = await extract({ entryFile: 'test.ts', content: code });
    const exp = result.spec.exports.find((e) => e.name === 'fetchData');

    expect(exp).toBeDefined();
    expect(exp?.flags?.async).toBe(true);
  });
});
