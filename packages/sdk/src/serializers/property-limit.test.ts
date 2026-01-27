import { describe, expect, test } from 'bun:test';
import { extract } from '../builder/spec-builder';

describe('property limit warning', () => {
  test('25 properties triggers onTruncation callback', async () => {
    const props = Array.from({ length: 25 }, (_, i) => `prop${i}: string;`).join('\n  ');
    const code = `
      export interface BigType {
        ${props}
      }
      export function useBig(obj: BigType): void {}
    `;

    const truncations: Array<{ typeName: string; actual: number; limit: number }> = [];
    await extract({
      entryFile: 'test.ts',
      content: code,
      onTruncation: (typeName, actual, limit) => {
        truncations.push({ typeName, actual, limit });
      },
    });

    expect(truncations.length).toBeGreaterThan(0);
    const bigTypeTruncation = truncations.find((t) => t.typeName === 'BigType');
    expect(bigTypeTruncation).toBeDefined();
    expect(bigTypeTruncation?.actual).toBe(25);
    expect(bigTypeTruncation?.limit).toBe(20);
  });

  test('15 properties does not trigger onTruncation', async () => {
    const props = Array.from({ length: 15 }, (_, i) => `prop${i}: string;`).join('\n  ');
    const code = `
      export interface SmallType {
        ${props}
      }
      export function useSmall(obj: SmallType): void {}
    `;

    const truncations: Array<{ typeName: string; actual: number; limit: number }> = [];
    await extract({
      entryFile: 'test.ts',
      content: code,
      onTruncation: (typeName, actual, limit) => {
        truncations.push({ typeName, actual, limit });
      },
    });

    const smallTypeTruncation = truncations.find((t) => t.typeName === 'SmallType');
    expect(smallTypeTruncation).toBeUndefined();
  });

  test('custom maxProperties limit of 50 works', async () => {
    const props = Array.from({ length: 30 }, (_, i) => `prop${i}: string;`).join('\n  ');
    const code = `
      export interface MediumType {
        ${props}
      }
      export function useMedium(obj: MediumType): void {}
    `;

    const truncations: Array<{ typeName: string; actual: number; limit: number }> = [];
    await extract({
      entryFile: 'test.ts',
      content: code,
      maxProperties: 50,
      onTruncation: (typeName, actual, limit) => {
        truncations.push({ typeName, actual, limit });
      },
    });

    // 30 props < 50 limit, so no truncation
    const mediumTypeTruncation = truncations.find((t) => t.typeName === 'MediumType');
    expect(mediumTypeTruncation).toBeUndefined();
  });

  test('custom maxProperties limit of 10 triggers truncation', async () => {
    const props = Array.from({ length: 15 }, (_, i) => `prop${i}: string;`).join('\n  ');
    const code = `
      export interface CustomLimitType {
        ${props}
      }
      export function useCustom(obj: CustomLimitType): void {}
    `;

    const truncations: Array<{ typeName: string; actual: number; limit: number }> = [];
    await extract({
      entryFile: 'test.ts',
      content: code,
      maxProperties: 10,
      onTruncation: (typeName, actual, limit) => {
        truncations.push({ typeName, actual, limit });
      },
    });

    const customTruncation = truncations.find((t) => t.typeName === 'CustomLimitType');
    expect(customTruncation).toBeDefined();
    expect(customTruncation?.actual).toBe(15);
    expect(customTruncation?.limit).toBe(10);
  });
});
