import { describe, expect, test } from 'bun:test';
import { extract } from '../builder/spec-builder';

// Lifted from .gap-repros/round4 — three fidelity gaps found by a full-
// replacement doc consumer (membership + content, no second extractor).
const FIXTURE = `
/** Operating mode. */
export enum Mode {
  /** Standard mode */
  Standard = 'standard',
  /** @deprecated Use Standard */
  Legacy = 'legacy',
}

/** Callable that also carries members. */
export type CallableWithProps = {
  (input: string): boolean;
  /** A label. */
  label: string;
};

/** Filters keyed by property name. */
export type PropertyFilters = {
  [key: string]: string[];
};
`;

const schemaOf = (v: unknown): Record<string, unknown> => (v ?? {}) as Record<string, unknown>;

describe('round 4 fidelity', () => {
  test('R4-1: enum members keep @deprecated tag and reason', async () => {
    const { spec } = await extract({ entryFile: 'test.ts', content: FIXTURE });
    const mode = spec.exports.find((e) => e.name === 'Mode');
    const legacy = mode?.members?.find((m) => m.name === 'Legacy');
    const standard = mode?.members?.find((m) => m.name === 'Standard');

    expect(legacy?.deprecated).toBe(true);
    expect(legacy?.tags).toContainEqual({ name: 'deprecated', text: 'Use Standard' });
    // Standard is unchanged: plain description, no deprecation.
    expect(standard?.description).toBe('Standard mode');
    expect(standard?.deprecated).toBeUndefined();
  });

  test('R4-2: callable object types keep their members', async () => {
    const { spec } = await extract({ entryFile: 'test.ts', content: FIXTURE });
    const callable = spec.exports.find((e) => e.name === 'CallableWithProps');
    const label = callable?.members?.find((m) => m.name === 'label');

    // The call signature survives...
    expect(schemaOf(callable?.schema)['x-ts-function']).toBe(true);
    // ...and so does the object half.
    expect(label).toBeDefined();
    expect(label?.description).toBe('A label.');
    expect(label?.schema).toEqual({ type: 'string' });
  });

  test('R4-3: index-signature aliases carry renderable x-ts-type', async () => {
    const { spec } = await extract({ entryFile: 'test.ts', content: FIXTURE });
    const reg = spec.types?.find((t) => t.name === 'PropertyFilters');
    const text = schemaOf(reg?.schema)['x-ts-type'] as string | undefined;
    expect(text).toBeDefined();
    expect(text).toContain('[key: string]');
    expect(text).toContain('string[]');
  });
});
