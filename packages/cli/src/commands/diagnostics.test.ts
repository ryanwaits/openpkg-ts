import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { $ } from 'bun';

describe('openpkg diagnostics', () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'diagnostics-test-'));
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('outputs JSON with diagnostics', async () => {
    const specPath = path.join(tmpDir, 'spec.json');
    const spec = {
      openpkg: '0.4.0',
      meta: { name: 'test-pkg' },
      exports: [
        { id: 'a', name: 'noDesc', kind: 'function' },
        { id: 'b', name: 'withDesc', kind: 'function', description: 'Has desc' },
        {
          id: 'c',
          name: 'depNoReason',
          kind: 'function',
          description: 'Something',
          deprecated: true,
        },
      ],
    };
    fs.writeFileSync(specPath, JSON.stringify(spec));

    const output = await $`bun packages/cli/bin/openpkg.ts diagnostics ${specPath}`.text();
    const result = JSON.parse(output);

    expect(result.summary.total).toBe(2);
    expect(result.summary.missingDescriptions).toBe(1);
    expect(result.summary.deprecatedNoReason).toBe(1);
    expect(result.diagnostics.missingDescriptions[0].exportName).toBe('noDesc');
  });

  it('handles malformed spec gracefully', async () => {
    const specPath = path.join(tmpDir, 'bad.json');
    fs.writeFileSync(specPath, '{ invalid json');

    const output = await $`bun packages/cli/bin/openpkg.ts diagnostics ${specPath}`.text();
    const result = JSON.parse(output);

    expect(result.error).toBeDefined();
  });
});
