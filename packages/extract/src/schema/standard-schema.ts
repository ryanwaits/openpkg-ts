/**
 * Standard Schema Runtime Extraction
 *
 * Extracts JSON Schema from libraries implementing StandardJSONSchemaV1.
 * Requires runtime execution (subprocess) to call ~standard.jsonSchema.output().
 *
 * @see https://standardschema.dev/json-schema
 */
import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Target version for JSON Schema generation.
 * @see https://standardschema.dev/json-schema
 */
export type StandardJSONSchemaTarget = 'draft-2020-12' | 'draft-07' | 'openapi-3.0' | (string & {});

/**
 * Options for JSON Schema generation methods.
 */
export interface StandardJSONSchemaOptions {
  /** Specifies the target version of the generated JSON Schema */
  readonly target: StandardJSONSchemaTarget;
  /** Vendor-specific parameters */
  readonly libraryOptions?: Record<string, unknown>;
}

/**
 * Standard JSON Schema v1 interface.
 * @see https://standardschema.dev/json-schema
 */
export interface StandardJSONSchemaV1<Input = unknown, Output = Input> {
  '~standard': {
    /** The version number of the standard (always 1) */
    version: 1;
    /** The vendor name of the schema library */
    vendor: string;
    /** Inferred types (optional) */
    types?: { input: Input; output: Output };
    /** JSON Schema conversion methods */
    jsonSchema: {
      /** Converts input type to JSON Schema */
      input: (options: StandardJSONSchemaOptions) => Record<string, unknown>;
      /** Converts output type to JSON Schema */
      output: (options: StandardJSONSchemaOptions) => Record<string, unknown>;
    };
  };
}

/**
 * Result of extracting Standard Schema from an export.
 */
export interface StandardSchemaExtractionResult {
  exportName: string;
  vendor: string;
  outputSchema: Record<string, unknown>;
  inputSchema?: Record<string, unknown>;
}

/**
 * Options for runtime Standard Schema extraction.
 */
export interface ExtractStandardSchemasOptions {
  /** Timeout in milliseconds (default: 10000) */
  timeout?: number;
  /** JSON Schema target version (default: 'draft-2020-12') */
  target?: StandardJSONSchemaTarget;
  /** Vendor-specific options to pass through */
  libraryOptions?: Record<string, unknown>;
}

/**
 * Result of Standard Schema extraction.
 */
export interface StandardSchemaExtractionOutput {
  schemas: Map<string, StandardSchemaExtractionResult>;
  errors: string[];
}

/**
 * Check if an object implements StandardJSONSchemaV1.
 * This is a static type guard - doesn't require runtime.
 */
export function isStandardJSONSchema(obj: unknown): obj is StandardJSONSchemaV1 {
  if (typeof obj !== 'object' || obj === null) return false;
  const std = (obj as Record<string, unknown>)['~standard'];
  if (typeof std !== 'object' || std === null) return false;
  const stdObj = std as Record<string, unknown>;
  // Per spec: version must be exactly 1
  if (stdObj.version !== 1) return false;
  if (typeof stdObj.vendor !== 'string') return false;
  const jsonSchema = stdObj.jsonSchema;
  if (typeof jsonSchema !== 'object' || jsonSchema === null) return false;
  const jsObj = jsonSchema as Record<string, unknown>;
  // Both input and output must be functions per spec
  return typeof jsObj.output === 'function' && typeof jsObj.input === 'function';
}

/**
 * Worker script that runs in subprocess to extract Standard Schema.
 * This is inlined to avoid file path issues.
 * Uses dynamic import() to support both ESM and CommonJS modules.
 */
const WORKER_SCRIPT = `
const path = require('path');
const { pathToFileURL } = require('url');

// TypeBox detection: schemas have Symbol.for('TypeBox.Kind') and are JSON Schema
const TYPEBOX_KIND = Symbol.for('TypeBox.Kind');

function isTypeBoxSchema(obj) {
  if (!obj || typeof obj !== 'object') return false;
  // TypeBox schemas always have Kind symbol (Union, Object, String, etc.)
  // Also check for common JSON Schema props to avoid false positives
  if (!obj[TYPEBOX_KIND]) return false;
  return typeof obj.type === 'string' || 'anyOf' in obj || 'oneOf' in obj || 'allOf' in obj;
}

function sanitizeTypeBoxSchema(schema) {
  // JSON.stringify removes symbol keys, keeping only JSON Schema props
  return JSON.parse(JSON.stringify(schema));
}

async function extract() {
  // With node -e, argv is: [node, arg1, arg2, ...]
  // (the -e script is NOT in argv)
  const [modulePath, optionsJson] = process.argv.slice(1);
  const { target, libraryOptions } = JSON.parse(optionsJson || '{}');

  try {
    // Import the module using dynamic import (works with ESM and CJS)
    const absPath = path.resolve(modulePath);
    const mod = await import(pathToFileURL(absPath).href);
    const results = [];

    // Build exports map - handle both ESM and CJS (where exports are in mod.default)
    const exports = {};
    for (const [name, value] of Object.entries(mod)) {
      if (name === 'default' && typeof value === 'object' && value !== null) {
        // CJS module: spread default exports
        Object.assign(exports, value);
      } else if (name !== 'default') {
        exports[name] = value;
      }
    }

    // Check each export
    for (const [name, value] of Object.entries(exports)) {
      if (name.startsWith('_')) continue;
      if (typeof value !== 'object' || value === null) continue;

      // Priority 1: Standard JSON Schema (Zod 4.2+, ArkType 2.1.28+, Valibot 1.2+)
      const std = value['~standard'];
      if (std && typeof std === 'object' && std.version === 1 && typeof std.vendor === 'string' && std.jsonSchema && typeof std.jsonSchema.output === 'function') {
        try {
          // Per spec: pass options object with target and optional libraryOptions
          const options = { target: target || 'draft-2020-12', ...(libraryOptions && { libraryOptions }) };
          const outputSchema = std.jsonSchema.output(options);
          const inputSchema = typeof std.jsonSchema.input === 'function' ? std.jsonSchema.input(options) : undefined;
          results.push({
            exportName: name,
            vendor: std.vendor,
            outputSchema,
            inputSchema
          });
        } catch (e) {
          // Skip schemas that fail to extract
        }
        continue;
      }

      // Priority 2: TypeBox (schema IS JSON Schema)
      if (isTypeBoxSchema(value)) {
        try {
          results.push({
            exportName: name,
            vendor: 'typebox',
            outputSchema: sanitizeTypeBoxSchema(value)
          });
        } catch (e) {
          // Skip schemas that fail to extract
        }
        continue;
      }
    }

    console.log(JSON.stringify({ success: true, results }));
  } catch (e) {
    console.log(JSON.stringify({ success: false, error: e.message }));
  }
}

extract();
`;

/**
 * Read outDir from tsconfig.json.
 * Returns normalized outDir path or null if not found.
 */
function readTsconfigOutDir(baseDir: string): string | null {
  const tsconfigPath = path.join(baseDir, 'tsconfig.json');

  try {
    if (!fs.existsSync(tsconfigPath)) {
      return null;
    }

    const content = fs.readFileSync(tsconfigPath, 'utf-8');
    // Strip comments (// and /* */) before parsing - tsconfig allows comments
    const stripped = content
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
    const tsconfig = JSON.parse(stripped);

    if (tsconfig.compilerOptions?.outDir) {
      // Normalize: handle "./build" vs "build"
      return tsconfig.compilerOptions.outDir.replace(/^\.\//, '');
    }
  } catch {
    // Ignore parse errors - use defaults
  }

  return null;
}

/**
 * Resolve compiled JS path from TypeScript source.
 * Reads tsconfig.json for outDir and tries multiple output patterns.
 * Supports .js, .mjs, and .cjs extensions.
 */
export function resolveCompiledPath(tsPath: string, baseDir: string): string | null {
  const relativePath = path.relative(baseDir, tsPath);
  const withoutExt = relativePath.replace(/\.tsx?$/, '');
  const srcPrefix = withoutExt.replace(/^src\//, '');

  // Read outDir from tsconfig.json
  const tsconfigOutDir = readTsconfigOutDir(baseDir);

  // Extensions to try (ESM/CJS support)
  const extensions = ['.js', '.mjs', '.cjs'];

  // Build candidates list - order matters (most specific first)
  const candidates: string[] = [];

  // 1. If tsconfig has outDir, try that first
  if (tsconfigOutDir) {
    for (const ext of extensions) {
      candidates.push(path.join(baseDir, tsconfigOutDir, `${srcPrefix}${ext}`));
    }
  }

  // 2. Common output patterns
  const commonOutDirs = ['dist', 'build', 'lib', 'out'];
  for (const outDir of commonOutDirs) {
    // Skip if same as tsconfig outDir (already added)
    if (outDir === tsconfigOutDir) continue;
    for (const ext of extensions) {
      candidates.push(path.join(baseDir, outDir, `${srcPrefix}${ext}`));
    }
  }

  // 3. Same location (for in-place compilation or bundlers)
  for (const ext of extensions) {
    candidates.push(path.join(baseDir, `${withoutExt}${ext}`));
  }

  // 4. Monorepo: try workspace root patterns
  // Check if we're in a packages/*/src structure
  const workspaceMatch = baseDir.match(/^(.+\/packages\/[^/]+)$/);
  if (workspaceMatch) {
    const pkgRoot = workspaceMatch[1];
    for (const ext of extensions) {
      // Package-level dist
      candidates.push(path.join(pkgRoot, 'dist', `${srcPrefix}${ext}`));
    }
  }

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

/**
 * Extract Standard Schema JSON Schemas from a compiled JS module.
 *
 * **Security Note**: This executes the module in a subprocess.
 * Only use with trusted code (user's own packages).
 *
 * @param compiledJsPath - Path to compiled .js file
 * @param options - Extraction options
 * @returns Extraction results with schemas and any errors
 */
export async function extractStandardSchemas(
  compiledJsPath: string,
  options: ExtractStandardSchemasOptions = {},
): Promise<StandardSchemaExtractionOutput> {
  const { timeout = 10000, target = 'draft-2020-12', libraryOptions } = options;

  const result: StandardSchemaExtractionOutput = {
    schemas: new Map(),
    errors: [],
  };

  if (!fs.existsSync(compiledJsPath)) {
    result.errors.push(`Compiled JS not found: ${compiledJsPath}`);
    return result;
  }

  // Pass options as JSON to subprocess
  const optionsJson = JSON.stringify({ target, libraryOptions });

  return new Promise((resolve) => {
    const child = spawn('node', ['-e', WORKER_SCRIPT, compiledJsPath, optionsJson], {
      timeout,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      if (code !== 0) {
        result.errors.push(`Extraction process failed: ${stderr || `exit code ${code}`}`);
        resolve(result);
        return;
      }

      try {
        const parsed = JSON.parse(stdout);
        if (!parsed.success) {
          result.errors.push(`Extraction failed: ${parsed.error}`);
          resolve(result);
          return;
        }

        for (const item of parsed.results) {
          result.schemas.set(item.exportName, {
            exportName: item.exportName,
            vendor: item.vendor,
            outputSchema: item.outputSchema,
            inputSchema: item.inputSchema,
          });
        }
      } catch (e) {
        result.errors.push(`Failed to parse extraction output: ${e}`);
      }

      resolve(result);
    });

    child.on('error', (err) => {
      result.errors.push(`Subprocess error: ${err.message}`);
      resolve(result);
    });
  });
}

/**
 * Extract Standard Schema from a TypeScript project.
 *
 * Convenience function that resolves compiled JS and extracts schemas.
 *
 * @param entryFile - TypeScript entry file path
 * @param baseDir - Project base directory
 * @param options - Extraction options
 */
export async function extractStandardSchemasFromProject(
  entryFile: string,
  baseDir: string,
  options: ExtractStandardSchemasOptions = {},
): Promise<StandardSchemaExtractionOutput> {
  const compiledPath = resolveCompiledPath(entryFile, baseDir);

  if (!compiledPath) {
    return {
      schemas: new Map(),
      errors: [`Could not find compiled JS for ${entryFile}. Build the project first.`],
    };
  }

  return extractStandardSchemas(compiledPath, options);
}
