import { describe, expect, test } from 'bun:test';
import { extract } from './spec-builder';

const FIXTURE = `
export function doThing(opts: { signal?: AbortSignal }): void {}
`;

describe('ambient/external type stubs', () => {
  test('AbortSignal registers as an opaque stub, transitive ambients stay out', async () => {
    const { spec } = await extract({ entryFile: 'test.ts', content: FIXTURE });
    const names = (spec.types ?? []).map((t) => t.name);

    const abort = spec.types?.find((t) => t.name === 'AbortSignal');
    expect(abort).toBeDefined();
    expect(abort?.kind).toBe('external');
    expect(abort?.external).toBe(true);
    expect(abort?.members).toBeUndefined();
    expect((abort?.schema as Record<string, unknown>)?.['x-ts-type']).toBe('AbortSignal');

    // The transitive ambient surface must not be dragged in
    for (const ambient of ['EventTarget', 'Event', 'AddEventListenerOptions']) {
      expect(names).not.toContain(ambient);
    }
    // Stub keeps the ref resolvable and the spec small
    expect((spec.types ?? []).length).toBeLessThan(5);
  });

  test('followExternal: true restores full expansion', async () => {
    const { spec } = await extract({
      entryFile: 'test.ts',
      content: FIXTURE,
      followExternal: true,
    });
    const abort = spec.types?.find((t) => t.name === 'AbortSignal');
    expect(abort).toBeDefined();
    // Full structural expansion — no opaque stub
    const schema = (abort?.schema ?? {}) as Record<string, unknown>;
    const hasStructure =
      abort?.members !== undefined || schema.properties !== undefined || schema.type === 'object';
    expect(hasStructure).toBe(true);
  });

  test('project-local types still expand fully by default', async () => {
    const code = `
interface Inner { value: string; }
export function use(inner: Inner): void {}
`;
    const { spec } = await extract({ entryFile: 'test.ts', content: code });
    const inner = spec.types?.find((t) => t.name === 'Inner');
    const props = ((inner?.schema ?? {}) as Record<string, Record<string, unknown>>).properties;
    expect(props?.value).toEqual({ type: 'string' });
  });
});
