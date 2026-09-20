import { describe, expect, test } from 'bun:test';
import type { SpecSchema } from '@openpkg-ts/spec';
import { extract } from '../builder/spec-builder';

const UNDEFINED = { type: 'null', 'x-ts-type': 'undefined' };

describe('anyOf branch dedupe', () => {
  test('string | null | undefined keeps distinct null and undefined branches', async () => {
    const code = `
      export interface Config {
        flags_api_host?: string | null;
        maybe: string | null | undefined;
      }
    `;
    const { spec } = await extract({ entryFile: 'test.ts', content: code });
    const config = spec.exports.find((e) => e.name === 'Config');
    const props = (config?.schema as { properties?: Record<string, SpecSchema> })?.properties;

    const host = (props?.flags_api_host as { anyOf?: SpecSchema[] })?.anyOf ?? [];
    expect(host).toContainEqual({ type: 'null' });
    expect(host).toContainEqual({ type: 'string' });
    expect(host).not.toContainEqual(UNDEFINED);
    expect(host).toHaveLength(2);

    const maybe = (props?.maybe as { anyOf?: SpecSchema[] })?.anyOf ?? [];
    expect(maybe).toContainEqual({ type: 'null' });
    expect(maybe).toContainEqual(UNDEFINED);
    expect(maybe).toContainEqual({ type: 'string' });
    expect(maybe).toHaveLength(3);
  });

  test('null | undefined stays two branches', async () => {
    const code = `
      export interface Wrap { onlyNull: null | undefined; }
    `;
    const { spec } = await extract({ entryFile: 'test.ts', content: code });
    const wrap = spec.exports.find((e) => e.name === 'Wrap');
    const props = (wrap?.schema as { properties?: Record<string, SpecSchema> })?.properties;
    const onlyNull = props?.onlyNull as { type?: string; anyOf?: SpecSchema[] };
    expect(onlyNull.anyOf).toContainEqual({ type: 'null' });
    expect(onlyNull.anyOf).toContainEqual(UNDEFINED);
    expect(onlyNull.anyOf).toHaveLength(2);
  });
});
