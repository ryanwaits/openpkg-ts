import { describe, expect, test } from 'bun:test';
import { extract } from '../builder/spec-builder';

/**
 * Past the expansion budget a schema degrades to type text. For a signature
 * instantiated from a generic (`Ctor<Str, StrDef>`'s `new (def: D): T`) the
 * written annotation `D` names the generic's parameter, not the argument.
 */
describe('degraded text of an instantiated signature', () => {
  test('names the type argument, not the type parameter', async () => {
    // One anonymous parameter type wide enough to spend the export's own budget
    const inner = Array.from({ length: 110 }, (_, v) => `v${v}: number`).join('; ');
    const huge = Array.from({ length: 100 }, (_, p) => `p${p}: { ${inner} }`).join('; ');
    const { spec, diagnostics } = await extract({
      entryFile: 'test.ts',
      content: `
        interface Ctor<T, D> { new (big: { ${huge} }, def: D): T }
        export interface StrDef { type: 'string' }
        export interface Str { def: StrDef }
        export const Str: Ctor<Str, StrDef> = null as any;`,
    });

    expect(diagnostics.some((d) => d.code === 'TYPE_EXPANSION_LIMIT')).toBe(true);
    const str = spec.exports.find((e) => e.name === 'Str');
    expect(str?.signatures?.[0].parameters?.[1]).toMatchObject({
      name: 'def',
      schema: { 'x-ts-type': 'StrDef' },
    });
  });
});
