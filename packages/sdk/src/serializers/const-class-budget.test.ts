import { describe, expect, test } from 'bun:test';
import { extract } from '../builder/spec-builder';

/**
 * Past the expansion budget a schema degrades to type text. For a signature
 * instantiated from a generic (`Ctor<Str, StrDef>`'s `new (def: D): T`) the
 * written annotation `D` names the generic's parameter, not the argument.
 */
describe('degraded text of an instantiated signature', () => {
  test('names the type argument, not the type parameter', async () => {
    const wide = Array.from({ length: 260 }, (_, i) => {
      const props = Array.from({ length: 80 }, (_, p) => `p${p}: { v${i}: number }`).join('; ');
      return `export function f${i}(): { ${props} } { return null as any; }`;
    }).join('\n');
    const { spec, diagnostics } = await extract({
      entryFile: 'test.ts',
      content: `${wide}
        interface Ctor<T, D> { new (def: D): T }
        export interface StrDef { type: 'string' }
        export interface Str { def: StrDef }
        export const Str: Ctor<Str, StrDef> = null as any;`,
    });

    expect(diagnostics.some((d) => d.code === 'TYPE_EXPANSION_LIMIT')).toBe(true);
    const str = spec.exports.find((e) => e.name === 'Str');
    expect(str?.signatures?.[0].parameters?.[0]).toMatchObject({
      name: 'def',
      schema: { 'x-ts-type': 'StrDef' },
    });
  });
});
