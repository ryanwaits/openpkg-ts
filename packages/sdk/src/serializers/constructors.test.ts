import { describe, expect, test } from 'bun:test';
import type { SpecExport } from '@openpkg-ts/spec';
import { extract } from '../builder/spec-builder';

function byName(exports: SpecExport[], name: string): SpecExport | undefined {
  return exports.find((e) => e.name === name);
}

describe('constructor JSDoc tags', () => {
  test('own constructor signature keeps tags and examples', async () => {
    const code = `
      /** Options for {@link Client}. */
      export interface ClientOptions {
        /** Host to connect to. */
        host?: string;
      }

      /** A minimal API client. */
      export class Client {
        /**
         * Create a new client.
         *
         * @param options - Connection options.
         *
         * @remarks
         * The constructor validates options eagerly and never throws asynchronously.
         *
         * @example
         * \`\`\`ts
         * const client = new Client({ host: 'example.com' })
         * \`\`\`
         */
        constructor(options?: ClientOptions) {
          void options;
        }
      }
    `;

    const { spec } = await extract({ entryFile: 'test.ts', content: code });
    const sig = byName(spec.exports, 'Client')?.signatures?.[0];

    expect(sig).toBeDefined();
    expect(sig?.description).toBe('Create a new client.');
    expect(sig?.tags?.map((t) => t.name)).toEqual(['param', 'remarks', 'example']);
    expect(sig?.tags?.find((t) => t.name === 'remarks')?.text).toContain(
      'validates options eagerly',
    );
    expect(sig?.examples).toHaveLength(1);
  });
});
