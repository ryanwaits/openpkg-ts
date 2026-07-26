import { describe, expect, test } from 'bun:test';
import { extract } from '../builder/spec-builder';

// Round 7 — the last two places that reconstructed text instead of reading it.
//
// A: a block tag runs until the next block tag, so a @param's later paragraphs
//    document the param. They were being deleted at the first blank line.
// B: @see reads source text (it must — see the regression tests below), and
//    every continuation line still carried its raw JSDoc `*` marker.
const FIXTURE = `
/**
 * Runs the job.
 *
 * @param mode - The mode.
 *
 *   Pass "fast" to skip validation. See {@link Other} for details.
 * @returns Nothing.
 */
export function run(mode: string): void {
  void mode;
}

/**
 * Reads it back.
 *
 * @see https://example.com/docs?a=1#frag
 * @see The transport guide,
 * which covers retries.
 * @param id - The id.
 *
 * {@label Storage}
 */
export function read(id: string): void {
  void id;
}

/** Referenced above. */
export interface Other {
  id: string;
}
`;

const extractFixture = () => extract({ entryFile: 'test.ts', content: FIXTURE });

describe('round 7A: @param keeps its later paragraphs', () => {
  test('a second paragraph is no longer deleted', async () => {
    const { spec } = await extractFixture();
    const param = spec.exports.find((e) => e.name === 'run')?.tags?.find((t) => t.name === 'param');

    expect(param?.param?.description).toBe(
      'The mode.\n\nPass "fast" to skip validation. See {@link Other} for details.',
    );
  });

  test('the signature parameter carries the same full text', async () => {
    const { spec } = await extractFixture();
    const param = spec.exports.find((e) => e.name === 'run')?.signatures?.[0]?.parameters?.[0];

    expect(param?.description).toBe(
      'The mode.\n\nPass "fast" to skip validation. See {@link Other} for details.',
    );
  });

  test('an inline tag in a later paragraph becomes reachable', async () => {
    const { spec } = await extractFixture();
    const param = spec.exports.find((e) => e.name === 'run')?.tags?.find((t) => t.name === 'param');

    expect(param?.inlineTags).toEqual([{ name: 'link', text: 'Other' }]);
  });

  test('prose paragraphs stay the param’s, not the comment’s', async () => {
    const { spec } = await extractFixture();

    expect(spec.exports.find((e) => e.name === 'run')).not.toHaveProperty('inlineTags');
  });
});

describe('round 7B: @see text fidelity', () => {
  test('a multi-line @see no longer leaks JSDoc line markers', async () => {
    const { spec } = await extractFixture();
    const see = spec.exports.find((e) => e.name === 'read')?.tags?.filter((t) => t.name === 'see');

    expect(see?.[1]?.text).toBe('The transport guide,\nwhich covers retries.');
    expect(see?.[1]?.text).not.toContain('*');
  });

  test('regression: the URL scheme survives', async () => {
    const { spec } = await extractFixture();
    const see = spec.exports.find((e) => e.name === 'read')?.tags?.filter((t) => t.name === 'see');

    // TypeScript's own flattening yields "://example.com/..." here — it reads the
    // scheme as a link target. Reading source text is what keeps it.
    expect(see?.[0]?.text).toBe('https://example.com/docs?a=1#frag');
  });

  test('regression: the leading token of a prose @see survives', async () => {
    const { spec } = await extractFixture();
    const see = spec.exports.find((e) => e.name === 'read')?.tags?.filter((t) => t.name === 'see');

    // Same cause as the URL case: getTextOfJSDocComment drops "The".
    expect(see?.[1]?.text.startsWith('The ')).toBe(true);
  });

  test('markdown at line start is not eaten by the marker strip', async () => {
    const code = `
      /**
       * Doc.
       * @see the list:
       * * first
       * * second
       */
      export const value = 1;
    `;
    const { spec } = await extract({ entryFile: 'test.ts', content: code });
    const see = spec.exports.find((e) => e.name === 'value')?.tags?.find((t) => t.name === 'see');

    // One marker per line is stripped, so the bullet itself remains.
    expect(see?.text).toBe('the list:\n* first\n* second');
  });
});

describe('round 7: round 6 controls still hold', () => {
  test('a trailing tag-only paragraph is still the comment’s, not the param’s', async () => {
    const { spec } = await extractFixture();
    const read = spec.exports.find((e) => e.name === 'read');
    const param = read?.tags?.find((t) => t.name === 'param');

    expect(param?.param?.description).toBe('The id.');
    expect(param).not.toHaveProperty('inlineTags');
    expect(read?.inlineTags).toEqual([{ name: 'label', text: 'Storage' }]);
  });

  test('a single-paragraph param is untouched', async () => {
    const code = `
      /**
       * Does a thing.
       * @param mode - The mode.
       */
      export function doThing(mode: string): void { void mode; }
    `;
    const { spec } = await extract({ entryFile: 'test.ts', content: code });
    const param = spec.exports
      .find((e) => e.name === 'doThing')
      ?.tags?.find((t) => t.name === 'param');

    expect(param?.text).toBe('mode - The mode.');
    expect(param?.param?.description).toBe('The mode.');
  });
});
