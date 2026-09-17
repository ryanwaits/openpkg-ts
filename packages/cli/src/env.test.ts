import { afterEach, describe, expect, test } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadCwdEnv, parseEnvText } from './env';

describe('parseEnvText', () => {
  test('strips quotes and inline comments', () => {
    const parsed = parseEnvText('AI_GATEWAY_API_KEY="audit-placeholder" # comment\n');
    expect(parsed.AI_GATEWAY_API_KEY).toBe('audit-placeholder');
  });

  test('handles export prefix and single quotes', () => {
    const parsed = parseEnvText("export TOKEN='abc def'\n");
    expect(parsed.TOKEN).toBe('abc def');
  });

  test('unquoted values keep hashes without a preceding space', () => {
    const parsed = parseEnvText('KEY=foo#bar\nOTHER=foo # drop\n');
    expect(parsed.KEY).toBe('foo#bar');
    expect(parsed.OTHER).toBe('foo');
  });

  test('skips comments and empty lines', () => {
    const parsed = parseEnvText('# hi\n\nFOO=1\n');
    expect(parsed).toEqual({ FOO: '1' });
  });

  test('unescapes double-quoted values', () => {
    const parsed = parseEnvText('KEY="a\\nb\\t\\"c"\n');
    expect(parsed.KEY).toBe('a\nb\t"c');
  });
});

describe('loadCwdEnv', () => {
  let dir: string;
  const prev = process.env.OPENPKG_ENV_TEST;

  afterEach(() => {
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
    if (prev === undefined) delete process.env.OPENPKG_ENV_TEST;
    else process.env.OPENPKG_ENV_TEST = prev;
    delete process.env.OPENPKG_ENV_LOCAL;
  });

  test('unquotes when process.env is unset', () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'openpkg-env-'));
    fs.writeFileSync(path.join(dir, '.env'), 'OPENPKG_ENV_TEST="audit-placeholder" # comment\n');
    delete process.env.OPENPKG_ENV_TEST;
    loadCwdEnv(dir);
    expect(process.env.OPENPKG_ENV_TEST ?? '').toBe('audit-placeholder');
  });

  test('unquotes, prefers .env.local, and keeps existing process.env', () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'openpkg-env-'));
    fs.writeFileSync(
      path.join(dir, '.env'),
      'OPENPKG_ENV_TEST="from-env" # comment\nOPENPKG_ENV_LOCAL=base\n',
    );
    fs.writeFileSync(path.join(dir, '.env.local'), 'OPENPKG_ENV_LOCAL=local\n');
    process.env.OPENPKG_ENV_TEST = 'already-set';
    delete process.env.OPENPKG_ENV_LOCAL;
    loadCwdEnv(dir);
    expect(process.env.OPENPKG_ENV_TEST).toBe('already-set');
    expect(process.env.OPENPKG_ENV_LOCAL ?? '').toBe('local');
  });
});
