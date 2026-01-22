import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { loadConfig, mergeConfig, CONFIG_FILENAME } from './config';

describe('config', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openpkg-config-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('loadConfig', () => {
    test('returns null when no config exists', () => {
      const result = loadConfig(tmpDir);
      expect(result).toBeNull();
    });

    test('loads from openpkg.config.json', () => {
      const config = {
        externals: {
          include: ['react', 'lodash'],
          exclude: ['internal-*'],
          depth: 2,
        },
      };
      fs.writeFileSync(
        path.join(tmpDir, CONFIG_FILENAME),
        JSON.stringify(config),
      );

      const result = loadConfig(tmpDir);
      expect(result).toEqual(config);
    });

    test('loads from package.json openpkg field', () => {
      const pkgConfig = {
        externals: {
          include: ['@org/*'],
        },
      };
      fs.writeFileSync(
        path.join(tmpDir, 'package.json'),
        JSON.stringify({ name: 'test-pkg', openpkg: pkgConfig }),
      );

      const result = loadConfig(tmpDir);
      expect(result).toEqual(pkgConfig);
    });

    test('openpkg.config.json takes precedence over package.json', () => {
      const fileConfig = { externals: { include: ['file-config'] } };
      const pkgConfig = { externals: { include: ['pkg-config'] } };

      fs.writeFileSync(
        path.join(tmpDir, CONFIG_FILENAME),
        JSON.stringify(fileConfig),
      );
      fs.writeFileSync(
        path.join(tmpDir, 'package.json'),
        JSON.stringify({ name: 'test-pkg', openpkg: pkgConfig }),
      );

      const result = loadConfig(tmpDir);
      expect(result).toEqual(fileConfig);
    });

    test('returns null for invalid JSON in config file', () => {
      fs.writeFileSync(path.join(tmpDir, CONFIG_FILENAME), '{ invalid json }');

      const result = loadConfig(tmpDir);
      expect(result).toBeNull();
    });

    test('returns null for package.json without openpkg field', () => {
      fs.writeFileSync(
        path.join(tmpDir, 'package.json'),
        JSON.stringify({ name: 'test-pkg' }),
      );

      const result = loadConfig(tmpDir);
      expect(result).toBeNull();
    });
  });

  describe('mergeConfig', () => {
    test('returns CLI options when no file config', () => {
      const cliOptions = {
        externals: { include: ['cli-pkg'] },
      };

      const result = mergeConfig(null, cliOptions);
      expect(result).toEqual(cliOptions);
    });

    test('CLI options override file config', () => {
      const fileConfig = {
        externals: {
          include: ['file-pkg'],
          exclude: ['file-exclude'],
          depth: 1,
        },
      };
      const cliOptions = {
        externals: { include: ['cli-pkg'] },
      };

      const result = mergeConfig(fileConfig, cliOptions);
      expect(result.externals?.include).toEqual(['cli-pkg']);
      expect(result.externals?.exclude).toEqual(['file-exclude']);
      expect(result.externals?.depth).toBe(1);
    });

    test('file config used when CLI option not provided', () => {
      const fileConfig = {
        externals: {
          include: ['file-pkg'],
          depth: 3,
        },
      };

      const result = mergeConfig(fileConfig, {});
      expect(result.externals?.include).toEqual(['file-pkg']);
      expect(result.externals?.depth).toBe(3);
    });
  });
});
