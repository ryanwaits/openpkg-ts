import { describe, expect, test } from 'bun:test';
import type { SpecExport } from '@openpkg-ts/spec';
import { extract } from './spec-builder';

/** `huge` and `huge2` each cost more than one budget; their neighbours share a type with them. */
const inner = Array.from({ length: 110 }, (_, v) => `v${v}: number`).join('; ');
const wide = Array.from({ length: 100 }, (_, p) => `p${p}: { ${inner} }`).join('; ');
const CODE = `
interface Shared { id: string; nested: { flag: boolean } }
export declare function before(s: Shared): { a: { b: { c: number } } };
export declare function huge(big: { ${wide} }, tail: { deep: { x: 1 } }, s: Shared): void;
export declare function huge2(big: { ${wide} }, s: Shared): void;
export declare function after(s: Shared): { a: { b: { c: number } } };
`;

async function run(only?: string[]) {
  const { spec, diagnostics } = await extract({
    entryFile: 'test.ts',
    content: CODE,
    ...(only ? { only } : {}),
  });
  const byName = new Map(spec.exports.map((e) => [e.name, e]));
  const limit = diagnostics.filter((d) => d.code === 'TYPE_EXPANSION_LIMIT');
  return { spec, byName, limit };
}

const returnsOf = (exp: SpecExport | undefined) => exp?.signatures?.[0].returns?.schema;

describe('expansion budget per export', () => {
  test('an export that spends its budget degrades alone and is named', async () => {
    const { byName, limit } = await run();

    expect(limit).toHaveLength(1);
    expect(limit[0].message.split(': ')[1]).toBe('huge, huge2');

    const [, tail] = byName.get('huge')?.signatures?.[0].parameters ?? [];
    expect(tail.schema).toEqual({ 'x-ts-type': '{ deep: { x: 1 } }' });
  });

  test('its neighbours keep full schemas, before and after it', async () => {
    const { byName, spec } = await run();
    const full = {
      type: 'object',
      properties: {
        a: {
          type: 'object',
          properties: {
            b: { type: 'object', properties: { c: { type: 'number' } }, required: ['c'] },
          },
          required: ['b'],
        },
      },
      required: ['a'],
    };

    expect(returnsOf(byName.get('before'))).toMatchObject(full);
    expect(returnsOf(byName.get('after'))).toMatchObject(full);
    expect(spec.types?.find((t) => t.id === 'Shared')?.schema).toMatchObject({
      properties: { nested: { properties: { flag: { type: 'boolean' } } } },
    });
  });

  test('the same export and shared type in a full run and under only', async () => {
    const full = await run();

    for (const name of ['before', 'huge', 'huge2', 'after']) {
      const alone = await run([name]);
      expect(alone.byName.get(name)).toEqual(full.byName.get(name) as SpecExport);
      expect(alone.spec.types?.find((t) => t.id === 'Shared')).toEqual(
        full.spec.types?.find((t) => t.id === 'Shared'),
      );
    }
  });
});
