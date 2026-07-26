import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
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

  // A small external package so `followExternal` can be exercised without
  // dragging in the entire DOM lib graph (AbortSignal → EventTarget → …),
  // which is both slow and irrelevant to what this asserts.
  describe('followExternal restores full expansion', () => {
    let dir: string;
    let entry: string;

    beforeAll(() => {
      dir = fs.mkdtempSync(path.join(os.tmpdir(), 'openpkg-followext-'));
      fs.writeFileSync(
        path.join(dir, 'package.json'),
        JSON.stringify({ name: 'consumer', version: '1.0.0' }),
      );
      const pkgDir = path.join(dir, 'node_modules', 'tiny-ext');
      fs.mkdirSync(pkgDir, { recursive: true });
      fs.writeFileSync(
        path.join(pkgDir, 'package.json'),
        JSON.stringify({ name: 'tiny-ext', version: '1.0.0', types: 'index.d.ts' }),
      );
      fs.writeFileSync(
        path.join(pkgDir, 'index.d.ts'),
        'export interface Widget { id: string; label: string; }\n',
      );
      entry = path.join(dir, 'entry.ts');
      fs.writeFileSync(
        entry,
        `import type { Widget } from 'tiny-ext';\nexport function use(w: Widget): void {}\n`,
      );
    });

    afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

    test('external type registers as an opaque stub by default', async () => {
      const { spec } = await extract({ entryFile: entry });
      const widget = spec.types?.find((t) => t.name === 'Widget');
      expect(widget?.external).toBe(true);
      expect(widget?.members).toBeUndefined();
      const schema = widget?.schema as Record<string, unknown>;
      expect(schema?.['x-ts-type']).toBe('Widget');
      // stub records its declaring package so users know what to follow
      expect(schema?.['x-ts-package']).toBe('tiny-ext');
    });

    test('followExternal glob matches the package', async () => {
      const { spec } = await extract({ entryFile: entry, followExternal: ['tiny-*'] });
      const widget = spec.types?.find((t) => t.name === 'Widget');
      const props = ((widget?.schema ?? {}) as Record<string, Record<string, unknown>>).properties;
      expect(props?.id).toEqual({ type: 'string' });
    });

    test('followExternal: true expands the external type fully', async () => {
      const { spec } = await extract({ entryFile: entry, followExternal: true });
      const widget = spec.types?.find((t) => t.name === 'Widget');
      expect(widget).toBeDefined();
      const schema = (widget?.schema ?? {}) as Record<string, unknown>;
      const props = (schema.properties ?? {}) as Record<string, unknown>;
      expect(props.id).toEqual({ type: 'string' });
      expect(props.label).toEqual({ type: 'string' });
    });

    test('followExternal: ["tiny-ext"] expands only the listed package', async () => {
      const { spec } = await extract({ entryFile: entry, followExternal: ['tiny-ext'] });
      const widget = spec.types?.find((t) => t.name === 'Widget');
      const props = ((widget?.schema ?? {}) as Record<string, Record<string, unknown>>).properties;
      expect(props?.id).toEqual({ type: 'string' });
    });
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
