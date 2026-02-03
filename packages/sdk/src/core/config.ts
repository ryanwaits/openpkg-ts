/**
 * Configuration file loading and merging for openpkg
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ExternalsConfig } from '../types';

/** openpkg configuration from config file or package.json */
export interface OpenpkgConfig {
  /** Configuration for resolving external package re-exports */
  externals?: ExternalsConfig;
}

/** Default config filename */
export const CONFIG_FILENAME = 'openpkg.config.json';

/**
 * Load openpkg configuration from the project directory
 *
 * Looks for config in order of precedence:
 * 1. openpkg.config.json
 * 2. package.json "openpkg" field
 *
 * @param cwd - Directory to search for config
 * @returns Loaded config or null if not found
 */
export function loadConfig(cwd: string): OpenpkgConfig | null {
  // 1. Check openpkg.config.json
  const configPath = path.join(cwd, CONFIG_FILENAME);
  if (fs.existsSync(configPath)) {
    try {
      const content = fs.readFileSync(configPath, 'utf-8');
      return JSON.parse(content) as OpenpkgConfig;
    } catch (err) {
      const msg = err instanceof SyntaxError ? err.message : String(err);
      console.warn(`Warning: Invalid JSON in ${CONFIG_FILENAME}: ${msg}`);
    }
  }

  // 2. Check package.json "openpkg" field
  const pkgPath = path.join(cwd, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const content = fs.readFileSync(pkgPath, 'utf-8');
      const pkg = JSON.parse(content);
      if (pkg.openpkg) {
        return pkg.openpkg as OpenpkgConfig;
      }
    } catch (err) {
      const msg = err instanceof SyntaxError ? err.message : String(err);
      console.warn(`Warning: Invalid JSON in package.json: ${msg}`);
    }
  }

  return null;
}

/**
 * Merge file config with CLI options (CLI takes precedence)
 *
 * @param fileConfig - Config loaded from file (or null)
 * @param cliOptions - Options provided via CLI flags
 * @returns Merged config
 */
export function mergeConfig(
  fileConfig: OpenpkgConfig | null,
  cliOptions: Partial<OpenpkgConfig>,
): OpenpkgConfig {
  if (!fileConfig) {
    return cliOptions as OpenpkgConfig;
  }

  // CLI options override file config
  const externals = {
    include: cliOptions.externals?.include ?? fileConfig.externals?.include,
    exclude: cliOptions.externals?.exclude ?? fileConfig.externals?.exclude,
    depth: cliOptions.externals?.depth ?? fileConfig.externals?.depth,
  };

  // Only include externals if at least one field is defined
  const hasExternals = externals.include || externals.exclude || externals.depth !== undefined;

  return hasExternals ? { externals } : {};
}
