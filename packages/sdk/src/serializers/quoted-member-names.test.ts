import { describe, expect, test } from 'bun:test';
import { extract } from '../builder/spec-builder';

/** zod's ZodType: a quoted member overrides the quoted member of its base. */
const QUOTED = `
interface Base { "~standard": { version: 1 }; 'kebab-name': string; 42: boolean }
export interface Derived extends Base { "~standard": { version: 1; json: true } }
declare const make: { new (): Derived };
export const Derived: typeof make = make;

export class Host { "quoted-prop" = 1; "quoted-method"(): void {} }
export class Sub extends Host { "quoted-prop" = 2; }
`;

describe('members whose names need quotes', () => {
  test('are named without the quotes and listed once', async () => {
    const { spec } = await extract({ entryFile: 'test.ts', content: QUOTED });
    const names = (name: string) =>
      spec.exports.find((e) => e.name === name)?.members?.map((m) => m.name) ?? [];

    expect(names('Derived').sort()).toEqual(['42', 'kebab-name', '~standard']);
    expect(names('Host').sort()).toEqual(['quoted-method', 'quoted-prop']);
    expect(names('Sub').sort()).toEqual(['quoted-method', 'quoted-prop']);
  });

  test('the overriding declaration wins', async () => {
    const { spec } = await extract({ entryFile: 'test.ts', content: QUOTED });
    const standard = spec.exports
      .find((e) => e.name === 'Derived')
      ?.members?.find((m) => m.name === '~standard');

    expect((standard as { inheritedFrom?: string }).inheritedFrom).toBeUndefined();
    expect(JSON.stringify(standard?.schema)).toContain('json');
  });
});
