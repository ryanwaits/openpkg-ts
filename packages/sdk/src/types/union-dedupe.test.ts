import { describe, expect, test } from 'bun:test';
import type { SpecSchema } from '@openpkg-ts/spec';
import { extract } from '../builder/spec-builder';

/** `string | null | undefined` must not emit duplicate null branches. */
describe('anyOf branch dedupe', () => {
  test('string | null | undefined → exactly one null branch', async () => {
    const code = `
      export interface Config {
        flags_api_host?: string | null;
        maybe: string | null | undefined;
      }
    `;
    const { spec } = await extract({ entryFile: 'test.ts', content: code });
    const config = spec.exports.find((e) => e.name === 'Config');
    const props = (config?.schema as { properties?: Record<string, SpecSchema> })?.properties;
    for (const key of ['flags_api_host', 'maybe'] as const) {
      const branches = (props?.[key] as { anyOf?: Array<{ type?: string }> })?.anyOf ?? [];
      expect(branches.filter((b) => b.type === 'null').length).toBe(1);
      expect(branches.filter((b) => b.type === 'string').length).toBe(1);
    }
  });

  test('union collapsing to a single branch drops the anyOf wrapper', async () => {
    const code = `
      export interface Wrap { onlyNull: null | undefined; }
    `;
    const { spec } = await extract({ entryFile: 'test.ts', content: code });
    const wrap = spec.exports.find((e) => e.name === 'Wrap');
    const props = (wrap?.schema as { properties?: Record<string, SpecSchema> })?.properties;
    const onlyNull = props?.onlyNull as { type?: string; anyOf?: unknown[] };
    expect(onlyNull.anyOf).toBeUndefined();
    expect(onlyNull.type).toBe('null');
  });
});
