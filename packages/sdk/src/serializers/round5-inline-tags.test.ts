import { describe, expect, test } from 'bun:test';
import { validateSpec } from '@openpkg-ts/spec';
import { extract } from '../builder/spec-builder';

// Lifted from .gap-repros/round5 — inline TSDoc tags ({@link}, {@label}) were
// passed through as raw text while block tags were structured, so a consumer
// had to run its own TSDoc parser to recover them.
const FIXTURE = `
/** Options for {@link send}. */
export interface SendOptions {
  /** Delivery timeout, in ms. {@label Transport} */
  timeoutMs?: number;
}

/**
 * Send a payload.
 *
 * Prefer {@link sendBatch} for more than one item.
 * {@label Transport}
 *
 * @remarks
 * Retries are handled by {@link RetryPolicy}. {@label Transport}
 *
 * @example
 * \`\`\`ts
 * // basic send
 * send('hello')
 * \`\`\`
 * {@label Transport}
 */
export function send(payload: string, options?: SendOptions): void {
  void payload;
  void options;
}

/** How retries are performed. */
export interface RetryPolicy {
  /** Attempts before giving up. */
  attempts: number;
}

/** Send many payloads. {@label Transport} */
export function sendBatch(items: string[]): void {
  void items;
}
`;

const extractFixture = () => extract({ entryFile: 'test.ts', content: FIXTURE });

describe('round 5 inline tags', () => {
  test('R5-1: an export carries the inline tags from its description', async () => {
    const { spec } = await extractFixture();
    const send = spec.exports.find((e) => e.name === 'send');

    expect(send?.inlineTags).toEqual([
      { name: 'link', text: 'sendBatch' },
      { name: 'label', text: 'Transport' },
    ]);
  });

  test('R5-2: a block tag carries its own inline tags', async () => {
    const { spec } = await extractFixture();
    const send = spec.exports.find((e) => e.name === 'send');
    const remarks = send?.tags?.find((t) => t.name === 'remarks');

    expect(remarks?.inlineTags).toEqual([
      { name: 'link', text: 'RetryPolicy' },
      { name: 'label', text: 'Transport' },
    ]);
  });

  test('R5-3: an example carries its own inline tags', async () => {
    const { spec } = await extractFixture();
    const send = spec.exports.find((e) => e.name === 'send');
    const example = send?.examples?.[0];

    expect(typeof example === 'string' ? undefined : example?.inlineTags).toEqual([
      { name: 'label', text: 'Transport' },
    ]);
  });

  test('R5-4: a member carries the inline tags from its description', async () => {
    const { spec } = await extractFixture();
    const options = spec.exports.find((e) => e.name === 'SendOptions');
    const timeoutMs = options?.members?.find((m) => m.name === 'timeoutMs');

    expect(timeoutMs?.inlineTags).toEqual([{ name: 'label', text: 'Transport' }]);
  });

  test('the text the tags came from is left exactly as it was', async () => {
    const { spec } = await extractFixture();
    const send = spec.exports.find((e) => e.name === 'send');
    const options = spec.exports.find((e) => e.name === 'SendOptions');

    expect(send?.description).toBe(
      'Send a payload.\n\nPrefer {@link sendBatch} for more than one item.\n{@label Transport}',
    );
    expect(send?.tags?.find((t) => t.name === 'remarks')?.text).toBe(
      'Retries are handled by {@link RetryPolicy}. {@label Transport}',
    );
    expect(options?.description).toBe('Options for {@link send}.');
    expect(options?.members?.find((m) => m.name === 'timeoutMs')?.description).toBe(
      'Delivery timeout, in ms. {@label Transport}',
    );
  });

  test('the field is omitted, not emptied, when a doc comment has no inline tags', async () => {
    const { spec } = await extractFixture();
    const retryPolicy = spec.exports.find((e) => e.name === 'RetryPolicy');

    expect(retryPolicy?.description).toBe('How retries are performed.');
    expect(retryPolicy).not.toHaveProperty('inlineTags');
    expect(retryPolicy?.members?.[0]).not.toHaveProperty('inlineTags');
  });

  test('the emitted spec still validates against the meta-schema', async () => {
    const { spec } = await extractFixture();

    expect(validateSpec(spec)).toEqual({ ok: true });
  });
});

describe('round 5 inline tag parsing', () => {
  test('parameter descriptions carry their inline tags', async () => {
    const code = `
      /**
       * Do a thing.
       * @param mode - one of {@link Mode}. {@label Config}
       */
      export function doThing(mode: string): void { void mode; }
    `;
    const { spec } = await extract({ entryFile: 'test.ts', content: code });
    const param = spec.exports.find((e) => e.name === 'doThing')?.signatures?.[0]?.parameters?.[0];

    expect(param?.description).toBe('one of {@link Mode}. {@label Config}');
    expect(param?.inlineTags).toEqual([
      { name: 'link', text: 'Mode' },
      { name: 'label', text: 'Config' },
    ]);
  });

  test('adjacent tags, link aliases, and escaped braces', async () => {
    const code = `
      /** {@link a}{@link b | B} and \\{@link notATag} plus {@labelWith2 x} */
      export const value = 1;
    `;
    const { spec } = await extract({ entryFile: 'test.ts', content: code });

    expect(spec.exports.find((e) => e.name === 'value')?.inlineTags).toEqual([
      { name: 'link', text: 'a' },
      { name: 'link', text: 'b | B' },
      { name: 'labelWith2', text: 'x' },
    ]);
  });

  test('a class method and its overloads carry inline tags', async () => {
    const code = `
      export class Client {
        /** Send it. {@label Transport} */
        send(payload: string): void { void payload; }
      }
    `;
    const { spec } = await extract({ entryFile: 'test.ts', content: code });
    const method = spec.exports
      .find((e) => e.name === 'Client')
      ?.members?.find((m) => m.name === 'send');

    expect(method?.inlineTags).toEqual([{ name: 'label', text: 'Transport' }]);
    expect(method?.signatures?.[0]?.inlineTags).toEqual([{ name: 'label', text: 'Transport' }]);
  });

  test('an enum member carries inline tags', async () => {
    const code = `
      export enum Mode {
        /** The fast one. {@label Perf} */
        Fast = 'fast',
      }
    `;
    const { spec } = await extract({ entryFile: 'test.ts', content: code });
    const member = spec.exports.find((e) => e.name === 'Mode')?.members?.[0];

    expect(member?.inlineTags).toEqual([{ name: 'label', text: 'Perf' }]);
  });
});
