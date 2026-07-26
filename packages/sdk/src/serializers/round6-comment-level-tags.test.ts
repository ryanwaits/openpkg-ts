import { describe, expect, test } from 'bun:test';
import { extract } from '../builder/spec-builder';

// Lifted from .gap-repros/round6 — an inline tag written outside any block tag
// (between two, or trailing after the last) was dropped entirely. TypeScript
// attaches that line to whichever block tag precedes it, and the param-separator
// strip then discarded it as "not part of the param".
//
// `capture` is the control: same tag, same file, in the summary. The risk on
// this fix is over-capturing, so it must not move.
const FIXTURE = `
/** Client options. */
export interface ClientOptions {
  /** API token. */
  token: string;
}

/**
 * Initializes the client.
 *
 * @param options - Connection options.
 *
 * {@label Initialization}
 *
 * @returns The initialized client.
 */
export function init(options: ClientOptions): string {
  return options.token;
}

/**
 * Sends one event. {@label Capture}
 *
 * @param name - Event name.
 */
export function capture(name: string): void {
  void name;
}

/**
 * Flushes the queue.
 *
 * @param force - Flush even when empty.
 *
 * {@label Capture}
 */
export function flush(force?: boolean): void {
  void force;
}
`;

const extractFixture = () => extract({ entryFile: 'test.ts', content: FIXTURE });

describe('round 6 comment-level inline tags', () => {
  test('R6-1: a tag between two block tags reaches the export', async () => {
    const { spec } = await extractFixture();
    const init = spec.exports.find((e) => e.name === 'init');

    expect(init?.inlineTags).toEqual([{ name: 'label', text: 'Initialization' }]);
  });

  test('R6-2: a tag trailing after the last block tag reaches the export', async () => {
    const { spec } = await extractFixture();
    const flush = spec.exports.find((e) => e.name === 'flush');

    expect(flush?.inlineTags).toEqual([{ name: 'label', text: 'Capture' }]);
  });

  test('R6-3 control: a tag in the summary line is unchanged', async () => {
    const { spec } = await extractFixture();
    const capture = spec.exports.find((e) => e.name === 'capture');

    expect(capture?.inlineTags).toEqual([{ name: 'label', text: 'Capture' }]);
    expect(capture?.description).toBe('Sends one event. {@label Capture}');
    expect(capture?.tags).toEqual([
      {
        name: 'param',
        text: 'name - Event name.',
        param: { name: 'name', description: 'Event name.' },
      },
    ]);
  });

  test('the hoisted tag is not claimed by the block tag it followed', async () => {
    const { spec } = await extractFixture();
    const init = spec.exports.find((e) => e.name === 'init');
    const param = init?.tags?.find((t) => t.name === 'param');

    expect(param).not.toHaveProperty('inlineTags');
    expect(param?.param?.description).toBe('Connection options.');
    expect(init?.signatures?.[0]?.parameters?.[0]).not.toHaveProperty('inlineTags');
  });

  test('existing text fields are byte-identical', async () => {
    const { spec } = await extractFixture();
    const init = spec.exports.find((e) => e.name === 'init');
    const flush = spec.exports.find((e) => e.name === 'flush');

    expect(init?.description).toBe('Initializes the client.');
    expect(init?.tags?.find((t) => t.name === 'param')?.text).toBe('options - Connection options.');
    expect(init?.tags?.find((t) => t.name === 'returns')?.text).toBe('The initialized client.');
    expect(flush?.description).toBe('Flushes the queue.');
    expect(flush?.tags?.find((t) => t.name === 'param')?.text).toBe(
      'force - Flush even when empty.',
    );
  });
});

describe('round 6 over-capture guards', () => {
  test('prose in a trailing paragraph stays with its block tag', async () => {
    const code = `
      /**
       * Does a thing.
       *
       * @param mode - The mode.
       *
       * See {@link Other} for the rest.
       */
      export function doThing(mode: string): void { void mode; }
    `;
    const { spec } = await extract({ entryFile: 'test.ts', content: code });
    const doThing = spec.exports.find((e) => e.name === 'doThing');

    // The paragraph is not tag-only, so it is the param's — not the comment's.
    // Round 6 only stopped it being hoisted; round 7 stopped it being deleted,
    // so the param now actually holds it.
    expect(doThing).not.toHaveProperty('inlineTags');
    expect(doThing?.tags?.find((t) => t.name === 'param')?.param?.description).toBe(
      'The mode.\n\nSee {@link Other} for the rest.',
    );
  });

  test('a tag that is the whole body of a block tag stays on that tag', async () => {
    const code = `
      /**
       * Does a thing.
       *
       * @remarks {@link Other}
       */
      export function doThing(): void {}
    `;
    const { spec } = await extract({ entryFile: 'test.ts', content: code });
    const doThing = spec.exports.find((e) => e.name === 'doThing');

    expect(doThing?.tags?.find((t) => t.name === 'remarks')?.inlineTags).toEqual([
      { name: 'link', text: 'Other' },
    ]);
    expect(doThing).not.toHaveProperty('inlineTags');
  });

  test('inline tags inside a block tag paragraph are not hoisted', async () => {
    const code = `
      /**
       * Does a thing.
       *
       * @param mode - one of {@link Mode}.
       */
      export function doThing(mode: string): void { void mode; }
    `;
    const { spec } = await extract({ entryFile: 'test.ts', content: code });
    const doThing = spec.exports.find((e) => e.name === 'doThing');

    expect(doThing).not.toHaveProperty('inlineTags');
    expect(doThing?.tags?.find((t) => t.name === 'param')?.inlineTags).toEqual([
      { name: 'link', text: 'Mode' },
    ]);
  });

  test('a class member picks up its comment-level tags too', async () => {
    const code = `
      export class Client {
        /**
         * Sends it.
         *
         * @param payload - The payload.
         *
         * {@label Transport}
         */
        send(payload: string): void { void payload; }
      }
    `;
    const { spec } = await extract({ entryFile: 'test.ts', content: code });
    const send = spec.exports
      .find((e) => e.name === 'Client')
      ?.members?.find((m) => m.name === 'send');

    expect(send?.inlineTags).toEqual([{ name: 'label', text: 'Transport' }]);
  });

  test('summary and comment-level tags are merged in document order', async () => {
    const code = `
      /**
       * Does a thing. {@label First}
       *
       * @param mode - The mode.
       *
       * {@label Second}
       */
      export function doThing(mode: string): void { void mode; }
    `;
    const { spec } = await extract({ entryFile: 'test.ts', content: code });

    expect(spec.exports.find((e) => e.name === 'doThing')?.inlineTags).toEqual([
      { name: 'label', text: 'First' },
      { name: 'label', text: 'Second' },
    ]);
  });
});
