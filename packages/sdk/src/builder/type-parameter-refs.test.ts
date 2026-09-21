import { describe, expect, test } from 'bun:test';
import { extract } from './spec-builder';

/** SWR's shape: type parameters named like lib types, defaulted to `any`. */
const SHADOWING = `
interface PublicConfiguration<Data = any, Error = any> {
  fallbackData?: Data;
  onError: (err: Error, key: string) => void;
  compare: (a: Data | undefined, b: Data | undefined) => boolean;
}
type FullConfiguration = { cache: Map<string, unknown> } & PublicConfiguration;
export declare function useConfig(): FullConfiguration;
`;

function refsIn(value: unknown, out: string[] = []): string[] {
  if (Array.isArray(value)) for (const v of value) refsIn(v, out);
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (k === '$ref' && typeof v === 'string') out.push(v);
      else refsIn(v, out);
    }
  }
  return out;
}

describe('type parameters are never $ref targets', () => {
  test('a parameter that shadows a lib type is written as text', async () => {
    const { spec } = await extract({ entryFile: 'test.ts', content: SHADOWING });
    const ids = new Set([...(spec.types ?? []), ...spec.exports].map((t) => `#/types/${t.id}`));

    expect(refsIn(spec).filter((ref) => !ids.has(ref))).toEqual([]);
    expect(refsIn(spec).filter((ref) => /Error|Data/.test(ref))).toEqual([]);

    const full = JSON.stringify(spec.types?.find((t) => t.id === 'FullConfiguration'));
    expect(full).toContain('{"x-ts-type":"Error"}');
    expect(full).toContain('{"x-ts-type":"Data"}');
  });
});
