import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  analyzeSpec,
  type Diagnostic,
  type ExtractOptions,
  extractSpec,
  type FilterCriteria,
  filterSpec,
  getExport,
  listExports,
  loadConfig,
  mergeConfig,
} from '@openpkg-ts/sdk';
import type { OpenPkg, SchemaVersion, SpecExportKind, SpecGenerationMeta } from '@openpkg-ts/spec';
import { getValidationErrors } from '@openpkg-ts/spec';
import { Command } from 'commander';

// =============================================================================
// Spec parent command with subcommands: snapshot, validate, filter, lint, list, get
// =============================================================================

const VALID_KINDS: SpecExportKind[] = [
  'function',
  'class',
  'variable',
  'interface',
  'type',
  'enum',
  'module',
  'namespace',
  'reference',
  'external',
];

function loadSpec(filePath: string): OpenPkg {
  const resolved = path.resolve(filePath);
  let content: string;
  let spec: unknown;

  try {
    content = fs.readFileSync(resolved, 'utf-8');
  } catch (err) {
    throw new Error(
      `Failed to read spec file: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  try {
    spec = JSON.parse(content);
  } catch (err) {
    throw new Error(
      `Invalid JSON in spec file: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // Validate spec structure
  const errors = getValidationErrors(spec);
  if (errors.length > 0) {
    const details = errors
      .slice(0, 5)
      .map((e) => `${e.instancePath || '/'}: ${e.message}`)
      .join('; ');
    throw new Error(`Invalid OpenPkg spec: ${details}`);
  }

  return spec as OpenPkg;
}

function parseList(val?: string): string[] | undefined {
  if (!val) return undefined;
  return val
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function validateKinds(kinds: string[]): SpecExportKind[] {
  const invalid = kinds.filter((k) => !VALID_KINDS.includes(k as SpecExportKind));
  if (invalid.length > 0) {
    throw new Error(
      `Invalid kind(s): ${invalid.join(', ')}. Valid kinds: ${VALID_KINDS.join(', ')}`,
    );
  }
  return kinds as SpecExportKind[];
}

function formatDiagnostics(diagnostics: Diagnostic[]): object[] {
  return diagnostics.map((d) => ({
    message: d.message,
    severity: d.severity,
    ...(d.code && { code: d.code }),
    ...(d.suggestion && { suggestion: d.suggestion }),
    ...(d.location && { location: d.location }),
  }));
}

// -----------------------------------------------------------------------------
// snapshot subcommand
// -----------------------------------------------------------------------------
function createSnapshotSubcommand(): Command {
  return new Command('snapshot')
    .description('Generate full OpenPkg spec from TypeScript entry point')
    .argument('<entry>', 'Entry point file path')
    .option('-o, --output <file>', 'Output file (default: openpkg.json)', 'openpkg.json')
    .option('--max-depth <n>', 'Max type depth (default: 4)', '4')
    .option('--skip-resolve', 'Skip external type resolution')
    .option('--runtime', 'Enable Standard Schema runtime extraction')
    .option('--only <exports>', 'Filter exports (comma-separated)')
    .option('--ignore <exports>', 'Ignore exports (comma-separated)')
    .option('--verify', 'Exit 1 if any exports fail')
    .option('--verbose', 'Show detailed output')
    .option('--quiet', 'Suppress extraction warnings')
    .option('--strict', 'Exit 1 if any extraction warnings')
    .option('--include-private', 'Include private/protected class members')
    .option('--external-include <patterns...>', 'Resolve re-exports from these packages')
    .option('--external-exclude <patterns...>', 'Never resolve from these packages')
    .option('--external-depth <n>', 'Max transitive depth for external resolution', '1')
    .action(async (entry: string, options) => {
      const entryFile = path.resolve(entry);
      const entryDir = path.dirname(entryFile);

      const fileConfig = loadConfig(entryDir);
      const cliConfig = options.externalInclude
        ? {
            externals: {
              include: options.externalInclude,
              exclude: options.externalExclude,
              depth: parseInt(options.externalDepth ?? '1', 10),
            },
          }
        : {};

      const mergedConfig = mergeConfig(fileConfig, cliConfig);

      const extractOptions: ExtractOptions = {
        entryFile,
        maxTypeDepth: parseInt(options.maxDepth ?? '4', 10),
        resolveExternalTypes: !options.skipResolve,
        schemaExtraction: options.runtime ? 'hybrid' : 'static',
        only: parseList(options.only),
        ignore: parseList(options.ignore),
        includePrivate: options.includePrivate,
        ...(mergedConfig.externals && { externals: mergedConfig.externals }),
      };

      try {
        const result = await extractSpec(extractOptions);
        const externalExports = result.spec.exports.filter((e) => e.kind === 'external');

        const summary = {
          exports: result.spec.exports.length,
          types: result.spec.types?.length ?? 0,
          diagnostics: result.diagnostics.length,
          ...(result.verification && {
            verification: {
              discovered: result.verification.discovered,
              extracted: result.verification.extracted,
              skipped: result.verification.skipped,
              failed: result.verification.failed,
              ...(options.verbose &&
                result.verification.details.skipped.length > 0 && {
                  skippedDetails: result.verification.details.skipped,
                }),
            },
          }),
          ...(externalExports.length > 0 && { external: { count: externalExports.length } }),
        };

        console.error(JSON.stringify(summary, null, 2));

        // Display extraction warnings (unless --quiet)
        const extractionWarnings = result.runtimeSchemas?.warnings ?? [];
        if (extractionWarnings.length > 0 && !options.quiet) {
          console.error(`\nSkipped ${extractionWarnings.length} schema(s) with extraction errors:`);
          for (const w of extractionWarnings) {
            console.error(`  - ${w.exportName ?? 'unknown'}: ${w.code} - ${w.message}`);
          }
        }

        // Exit 1 if --strict and warnings exist
        if (options.strict && extractionWarnings.length > 0) {
          console.error(
            JSON.stringify(
              {
                error: 'Extraction warnings present (--strict mode)',
                warnings: extractionWarnings,
              },
              null,
              2,
            ),
          );
          process.exit(1);
        }

        if (options.verify && result.verification && result.verification.failed > 0) {
          console.error(
            JSON.stringify(
              {
                error: 'Export verification failed',
                failed: result.verification.details.failed,
                diagnostics: formatDiagnostics(result.diagnostics),
              },
              null,
              2,
            ),
          );
          process.exit(1);
        }

        const specJson = JSON.stringify(result.spec, null, 2);

        if (options.output === '-') {
          console.log(specJson);
        } else {
          const outputPath = path.resolve(options.output ?? 'openpkg.json');
          fs.writeFileSync(outputPath, specJson);
          console.error(`Wrote ${outputPath}`);
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        console.error(JSON.stringify({ error: error.message }, null, 2));
        process.exit(1);
      }
    });
}

// -----------------------------------------------------------------------------
// validate subcommand
// -----------------------------------------------------------------------------
function createValidateSubcommand(): Command {
  return new Command('validate')
    .description('Validate an OpenPkg spec against the schema')
    .argument('<spec>', 'Path to spec file (JSON)')
    .option('--version <version>', 'Schema version to validate against (default: latest)')
    .action(async (specPath: string, options: { version?: string }) => {
      try {
        const spec = loadSpec(specPath);
        const version = (options.version ?? 'latest') as SchemaVersion;
        const errors = getValidationErrors(spec, version);

        console.log(JSON.stringify({ valid: errors.length === 0, errors }, null, 2));

        if (errors.length > 0) process.exit(1);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        console.error(JSON.stringify({ error: error.message }, null, 2));
        process.exit(1);
      }
    });
}

// -----------------------------------------------------------------------------
// filter subcommand
// -----------------------------------------------------------------------------
function createFilterSubcommand(): Command {
  return new Command('filter')
    .description('Filter an OpenPkg spec by various criteria')
    .argument('<spec>', 'Path to spec file (JSON)')
    .option('--kind <kinds>', 'Filter by kinds (comma-separated)')
    .option('--name <names>', 'Filter by exact names (comma-separated)')
    .option('--id <ids>', 'Filter by IDs (comma-separated)')
    .option('--tag <tags>', 'Filter by tags (comma-separated)')
    .option('--deprecated', 'Only deprecated exports')
    .option('--no-deprecated', 'Exclude deprecated exports')
    .option('--has-description', 'Only exports with descriptions')
    .option('--missing-description', 'Only exports without descriptions')
    .option('--search <term>', 'Search name/description')
    .option('--search-members', 'Also search member names/descriptions')
    .option('--search-docs', 'Also search param/return descriptions')
    .option('--module <path>', 'Filter by source file path')
    .option('-o, --output <file>', 'Output file (default: stdout)')
    .option('--summary', 'Only output matched/total counts')
    .option('--quiet', 'Output raw spec only')
    .action(async (specPath: string, options) => {
      try {
        const spec = loadSpec(specPath);
        const criteria: FilterCriteria = {};

        if (options.kind) {
          const kinds = parseList(options.kind);
          if (kinds) criteria.kinds = validateKinds(kinds);
        }
        if (options.name) criteria.names = parseList(options.name);
        if (options.id) criteria.ids = parseList(options.id);
        if (options.tag) criteria.tags = parseList(options.tag);
        if (options.deprecated !== undefined) criteria.deprecated = options.deprecated;
        if (options.hasDescription) criteria.hasDescription = true;
        if (options.missingDescription) criteria.hasDescription = false;
        if (options.search) criteria.search = options.search;
        if (options.searchMembers) criteria.searchMembers = true;
        if (options.searchDocs) criteria.searchDocs = true;
        if (options.module) criteria.module = options.module;

        const result = filterSpec(spec, criteria);

        let output: unknown;
        if (options.summary) {
          output = { matched: result.matched, total: result.total };
        } else if (options.quiet) {
          output = result.spec;
        } else {
          output = { spec: result.spec, matched: result.matched, total: result.total };
        }

        const json = JSON.stringify(output, null, 2);

        if (options.output) {
          fs.writeFileSync(path.resolve(options.output), json);
        } else {
          console.log(json);
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        console.error(JSON.stringify({ error: error.message }, null, 2));
        process.exit(1);
      }
    });
}

// -----------------------------------------------------------------------------
// lint subcommand (renamed from diagnostics)
// -----------------------------------------------------------------------------
function createLintSubcommand(): Command {
  return new Command('lint')
    .description('Analyze spec for quality issues (missing docs, deprecated without reason)')
    .argument('<spec>', 'Path to spec file (JSON)')
    .option('--verbose', 'Show detailed information')
    .action(async (specPath: string, options: { verbose?: boolean }) => {
      try {
        const spec = loadSpec(specPath);
        const diagnostics = analyzeSpec(spec);
        const generation = spec.generation as SpecGenerationMeta | undefined;
        const skipped = generation?.skipped ?? [];
        const externalExports = spec.exports.filter((e) => e.kind === 'external');

        const byReason: Record<string, number> = {};
        for (const skip of skipped) {
          byReason[skip.reason] = (byReason[skip.reason] ?? 0) + 1;
        }

        const result = {
          summary: {
            total:
              diagnostics.missingDescriptions.length +
              diagnostics.deprecatedNoReason.length +
              diagnostics.missingParamDocs.length,
            missingDescriptions: diagnostics.missingDescriptions.length,
            deprecatedNoReason: diagnostics.deprecatedNoReason.length,
            missingParamDocs: diagnostics.missingParamDocs.length,
            ...(skipped.length > 0 && { skippedExports: skipped.length }),
            ...(externalExports.length > 0 && { externalExports: externalExports.length }),
          },
          diagnostics,
          ...(skipped.length > 0 && {
            skippedExports: {
              total: skipped.length,
              byReason,
              ...(options.verbose && { details: skipped }),
            },
          }),
          ...(externalExports.length > 0 && {
            externalExports: {
              count: externalExports.length,
              ...(options.verbose && {
                details: externalExports.map((e) => ({ name: e.name, package: e.source?.package })),
              }),
            },
          }),
        };

        console.log(JSON.stringify(result, null, 2));
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        console.error(JSON.stringify({ error: error.message }, null, 2));
        process.exit(1);
      }
    });
}

// -----------------------------------------------------------------------------
// list subcommand
// -----------------------------------------------------------------------------
function createListSubcommand(): Command {
  return new Command('list')
    .description('List exports from a TypeScript entry point')
    .argument('<entry>', 'Entry point file path')
    .action(async (entry: string) => {
      const entryFile = path.resolve(entry);
      const result = await listExports({ entryFile });

      if (result.errors.length > 0) {
        console.error(JSON.stringify({ errors: result.errors }, null, 2));
        process.exit(1);
      }

      console.log(JSON.stringify(result.exports, null, 2));
    });
}

// -----------------------------------------------------------------------------
// get subcommand
// -----------------------------------------------------------------------------
function createGetSubcommand(): Command {
  return new Command('get')
    .description('Get detailed spec for a single export')
    .argument('<entry>', 'Entry point file path')
    .argument('<name>', 'Export name')
    .action(async (entry: string, name: string) => {
      const entryFile = path.resolve(entry);
      const result = await getExport({ entryFile, exportName: name });

      if (!result.export) {
        const errorMsg =
          result.errors.length > 0 ? result.errors.join('; ') : `Export '${name}' not found`;
        console.error(JSON.stringify({ error: errorMsg }, null, 2));
        process.exit(1);
      }

      const output: Record<string, unknown> = { export: result.export };
      if (result.types.length > 0) {
        output.types = result.types;
      }
      console.log(JSON.stringify(output, null, 2));
    });
}

// =============================================================================
// Export parent command
// =============================================================================
export function createSpecCommand(): Command {
  const spec = new Command('spec').description('Spec extraction and manipulation commands');

  spec.addCommand(createSnapshotSubcommand());
  spec.addCommand(createValidateSubcommand());
  spec.addCommand(createFilterSubcommand());
  spec.addCommand(createLintSubcommand());
  spec.addCommand(createListSubcommand());
  spec.addCommand(createGetSubcommand());

  return spec;
}
