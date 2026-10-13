import { afterEach, describe, expect, test } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { extract } from '../builder/spec-builder';

// The SDK-client shape: a public client extends a base whose transport is protected.
const SOURCE = `class BaseClient {
  protected baseUrl = "https://example.com";
  protected async request(path: string): Promise<string> {
    return this.baseUrl + path;
  }
  /** Public on the base, so callers can reach it through the subclass. */
  ping(): boolean {
    return true;
  }
}

export class Client extends BaseClient {
  readonly name = "client";
  protected token = "";
  list(): string[] {
    return [];
  }
}
`;

function write(file: string, content: string) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

describe('inherited member visibility', () => {
  let tmp: string;

  afterEach(() => {
    if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
  });

  function writePackage(): string {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'openpkg-inherited-visibility-'));
    write(path.join(tmp, 'package.json'), JSON.stringify({ name: 'pkg' }));
    write(
      path.join(tmp, 'tsconfig.json'),
      JSON.stringify({ compilerOptions: { target: 'ES2022', strict: true } }),
    );
    const entry = path.join(tmp, 'src/index.ts');
    write(entry, SOURCE);
    return entry;
  }

  test('protected members inherited from a base class are left out by default', async () => {
    const result = await extract({ entryFile: writePackage() });

    const client = result.spec.exports.find((e) => e.name === 'Client');
    const names = client?.members?.map((m) => m.name);
    expect(names).toContain('list');
    expect(names).toContain('ping');
    expect(names).not.toContain('request');
    expect(names).not.toContain('baseUrl');
    expect(names).not.toContain('token');
  });

  test('a class schema built from its members leaves inherited protected members out', async () => {
    const result = await extract({ entryFile: writePackage() });

    const client = result.spec.exports.find((e) => e.name === 'Client');
    const schema = client?.schema as { properties?: Record<string, unknown> } | undefined;
    const keys = Object.keys(schema?.properties ?? {});
    expect(keys).toContain('list');
    expect(keys).toContain('ping');
    expect(keys).not.toContain('request');
    expect(keys).not.toContain('token');
  });

  test('includePrivate keeps inherited protected members, tagged', async () => {
    const result = await extract({ entryFile: writePackage(), includePrivate: true });

    const client = result.spec.exports.find((e) => e.name === 'Client');
    const request = client?.members?.find((m) => m.name === 'request');
    expect(request?.visibility).toBe('protected');
  });
});
