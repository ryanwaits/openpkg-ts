import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { $ } from 'bun';

describe('openpkg filter', () => {
  let tmpDir: string;
  let specPath: string;

  const spec = {
    openpkg: '0.4.0',
    meta: { name: 'test-pkg' },
    exports: [
      { id: 'a', name: 'myFunction', kind: 'function', description: 'A function' },
      { id: 'b', name: 'MyClass', kind: 'class', description: 'A class' },
      { id: 'c', name: 'myVar', kind: 'variable' },
      { id: 'd', name: 'deprecatedFn', kind: 'function', deprecated: true, description: 'Old' },
      {
        id: 'e',
        name: 'taggedFn',
        kind: 'function',
        tags: [{ name: 'beta' }],
        description: 'Beta feature',
      },
      {
        id: 'f',
        name: 'anotherClass',
        kind: 'class',
        source: { file: 'src/utils/helpers.ts' },
      },
    ],
  };

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'filter-test-'));
    specPath = path.join(tmpDir, 'spec.json');
    fs.writeFileSync(specPath, JSON.stringify(spec));
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('filters by kind', async () => {
    const output = await $`bun packages/cli/bin/openpkg.ts filter ${specPath} --kind function`.text();
    const result = JSON.parse(output);

    expect(result.matched).toBe(3);
    expect(result.total).toBe(6);
    expect(result.spec.exports.every((e: { kind: string }) => e.kind === 'function')).toBe(true);
  });

  it('filters by multiple kinds', async () => {
    const output =
      await $`bun packages/cli/bin/openpkg.ts filter ${specPath} --kind function,class`.text();
    const result = JSON.parse(output);

    expect(result.matched).toBe(5);
  });

  it('filters by name', async () => {
    const output =
      await $`bun packages/cli/bin/openpkg.ts filter ${specPath} --name myFunction,MyClass`.text();
    const result = JSON.parse(output);

    expect(result.matched).toBe(2);
  });

  it('filters by deprecated flag', async () => {
    const output = await $`bun packages/cli/bin/openpkg.ts filter ${specPath} --deprecated`.text();
    const result = JSON.parse(output);

    expect(result.matched).toBe(1);
    expect(result.spec.exports[0].name).toBe('deprecatedFn');
  });

  it('filters by non-deprecated', async () => {
    const output =
      await $`bun packages/cli/bin/openpkg.ts filter ${specPath} --no-deprecated`.text();
    const result = JSON.parse(output);

    expect(result.matched).toBe(5);
  });

  it('filters by has-description', async () => {
    const output =
      await $`bun packages/cli/bin/openpkg.ts filter ${specPath} --has-description`.text();
    const result = JSON.parse(output);

    expect(result.matched).toBe(4);
  });

  it('filters by missing-description', async () => {
    const output =
      await $`bun packages/cli/bin/openpkg.ts filter ${specPath} --missing-description`.text();
    const result = JSON.parse(output);

    expect(result.matched).toBe(2);
  });

  it('filters by search term', async () => {
    const output = await $`bun packages/cli/bin/openpkg.ts filter ${specPath} --search beta`.text();
    const result = JSON.parse(output);

    expect(result.matched).toBe(1);
    expect(result.spec.exports[0].name).toBe('taggedFn');
  });

  it('filters by tag', async () => {
    const output = await $`bun packages/cli/bin/openpkg.ts filter ${specPath} --tag beta`.text();
    const result = JSON.parse(output);

    expect(result.matched).toBe(1);
    expect(result.spec.exports[0].name).toBe('taggedFn');
  });

  it('filters by module path', async () => {
    const output =
      await $`bun packages/cli/bin/openpkg.ts filter ${specPath} --module src/utils`.text();
    const result = JSON.parse(output);

    expect(result.matched).toBe(1);
    expect(result.spec.exports[0].name).toBe('anotherClass');
  });

  it('combines filters with AND logic', async () => {
    const output =
      await $`bun packages/cli/bin/openpkg.ts filter ${specPath} --kind function --has-description`.text();
    const result = JSON.parse(output);

    expect(result.matched).toBe(3);
  });

  it('outputs summary only with --summary', async () => {
    const output =
      await $`bun packages/cli/bin/openpkg.ts filter ${specPath} --kind function --summary`.text();
    const result = JSON.parse(output);

    expect(result.matched).toBe(3);
    expect(result.total).toBe(6);
    expect(result.spec).toBeUndefined();
  });

  it('outputs raw spec with --quiet', async () => {
    const output =
      await $`bun packages/cli/bin/openpkg.ts filter ${specPath} --kind function --quiet`.text();
    const result = JSON.parse(output);

    expect(result.openpkg).toBe('0.4.0');
    expect(result.exports.length).toBe(3);
    expect(result.matched).toBeUndefined();
  });

  it('writes to file with --output', async () => {
    const outPath = path.join(tmpDir, 'filtered.json');
    await $`bun packages/cli/bin/openpkg.ts filter ${specPath} --kind class -o ${outPath}`.text();

    const content = JSON.parse(fs.readFileSync(outPath, 'utf-8'));
    expect(content.matched).toBe(2);
  });

  it('errors on invalid kind', async () => {
    const proc = await $`bun packages/cli/bin/openpkg.ts filter ${specPath} --kind invalid`
      .nothrow()
      .quiet();
    const result = JSON.parse(proc.stderr.toString());

    expect(result.error).toContain('Invalid kind(s): invalid');
    expect(result.error).toContain('Valid kinds:');
  });

  it('returns all exports with no criteria', async () => {
    const output = await $`bun packages/cli/bin/openpkg.ts filter ${specPath}`.text();
    const result = JSON.parse(output);

    expect(result.matched).toBe(6);
    expect(result.total).toBe(6);
  });

  it('handles empty spec', async () => {
    const emptyPath = path.join(tmpDir, 'empty.json');
    fs.writeFileSync(emptyPath, JSON.stringify({ openpkg: '0.4.0', meta: {}, exports: [] }));

    const output = await $`bun packages/cli/bin/openpkg.ts filter ${emptyPath} --kind function`.text();
    const result = JSON.parse(output);

    expect(result.matched).toBe(0);
    expect(result.total).toBe(0);
  });

  it('errors on malformed JSON', async () => {
    const badPath = path.join(tmpDir, 'bad.json');
    fs.writeFileSync(badPath, '{ invalid json }');

    const proc = await $`bun packages/cli/bin/openpkg.ts filter ${badPath}`.nothrow().quiet();
    const result = JSON.parse(proc.stderr.toString());

    expect(result.error).toBeDefined();
  });

  it('errors on missing file', async () => {
    const proc = await $`bun packages/cli/bin/openpkg.ts filter /nonexistent/path.json`
      .nothrow()
      .quiet();
    const result = JSON.parse(proc.stderr.toString());

    expect(result.error).toBeDefined();
  });
});
