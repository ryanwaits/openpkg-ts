import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  type Diagnostic,
  type ExtractOptions,
  extractSpec,
  loadConfig,
  mergeConfig,
} from '@openpkg-ts/sdk';
import { Command } from 'commander';

interface SnapshotCommandOptions {
  output?: string;
  maxDepth?: string;
  skipResolve?: boolean;
  runtime?: boolean;
  only?: string;
  ignore?: string;
  verify?: boolean;
  verbose?: boolean;
  includePrivate?: boolean;
  externalInclude?: string[];
  externalExclude?: string[];
  externalDepth?: string;
}

function parseFilter(value: string | undefined): string[] | undefined {
  if (!value) return undefined;
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
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

export function createSnapshotCommand(): Command {
  return new Command('snapshot')
    .description(
      'Generate full OpenPkg spec from TypeScript entry point\n\n' +
        'Config: Reads from openpkg.config.json or package.json "openpkg" field.\n' +
        'CLI flags override config file settings.',
    )
    .argument('<entry>', 'Entry point file path')
    .option(
      '-o, --output <file>',
      'Output file (default: openpkg.json, use - for stdout)',
      'openpkg.json',
    )
    .option('--max-depth <n>', 'Max type depth (default: 4)', '4')
    .option('--skip-resolve', 'Skip external type resolution')
    .option('--runtime', 'Enable Standard Schema runtime extraction')
    .option('--only <exports>', 'Filter exports (comma-separated, wildcards supported)')
    .option('--ignore <exports>', 'Ignore exports (comma-separated, wildcards supported)')
    .option('--verify', 'Exit 1 if any exports fail')
    .option('--verbose', 'Show detailed output including skipped exports')
    .option('--include-private', 'Include private/protected class members')
    .option(
      '--external-include <patterns...>',
      'Resolve re-exports from these packages (globs supported)',
    )
    .option('--external-exclude <patterns...>', 'Never resolve from these packages')
    .option('--external-depth <n>', 'Max transitive depth for external resolution (default: 1)', '1')
    .action(async (entry: string, options: SnapshotCommandOptions) => {
      const entryFile = path.resolve(entry);
      const entryDir = path.dirname(entryFile);

      // Load config from file (openpkg.config.json or package.json)
      const fileConfig = loadConfig(entryDir);

      // Build CLI config from flags
      const cliConfig = options.externalInclude
        ? {
            externals: {
              include: options.externalInclude,
              exclude: options.externalExclude,
              depth: parseInt(options.externalDepth ?? '1', 10),
            },
          }
        : {};

      // Merge: CLI overrides file config
      const mergedConfig = mergeConfig(fileConfig, cliConfig);

      const extractOptions: ExtractOptions = {
        entryFile,
        maxTypeDepth: parseInt(options.maxDepth ?? '4', 10),
        resolveExternalTypes: !options.skipResolve,
        schemaExtraction: options.runtime ? 'hybrid' : 'static',
        only: parseFilter(options.only),
        ignore: parseFilter(options.ignore),
        includePrivate: options.includePrivate,
        // External package resolution from merged config
        ...(mergedConfig.externals && { externals: mergedConfig.externals }),
      };

      try {
        const result = await extractSpec(extractOptions);

        // Count external exports (re-exports from external packages without full type info)
        const externalExports = result.spec.exports.filter((e) => e.kind === 'external');

        // Build summary for stderr
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
              // Include skipped details in verbose mode
              ...(options.verbose &&
                result.verification.details.skipped.length > 0 && {
                  skippedDetails: result.verification.details.skipped,
                }),
            },
          }),
          ...(externalExports.length > 0 && {
            external: {
              count: externalExports.length,
              // Include details in verbose mode
              ...(options.verbose && {
                exports: externalExports.map((e) => ({
                  name: e.name,
                  package: e.source?.package,
                })),
              }),
            },
          }),
          ...(result.runtimeSchemas && {
            runtime: {
              extracted: result.runtimeSchemas.extracted,
              merged: result.runtimeSchemas.merged,
              vendors: result.runtimeSchemas.vendors,
            },
          }),
        };

        // Write summary to stderr
        console.error(JSON.stringify(summary, null, 2));

        // Show user-friendly messages for external exports and skipped exports
        if (externalExports.length > 0 || (result.verification?.skipped ?? 0) > 0) {
          console.error(''); // blank line before warnings

          // External exports message
          if (externalExports.length > 0) {
            if (options.verbose) {
              console.error(
                `⚠ ${externalExports.length} external re-export(s) (install dependencies for full type info):`,
              );
              for (const exp of externalExports) {
                console.error(`  - ${exp.name} from "${exp.source?.package}"`);
              }
            } else {
              console.error(
                `⚠ ${externalExports.length} external re-export(s) (install dependencies for full type info)`,
              );
            }
          }

          // Skipped exports message
          const skipped = result.verification?.details.skipped ?? [];
          if (skipped.length > 0) {
            if (options.verbose) {
              console.error(`⚠ ${skipped.length} export(s) skipped:`);
              for (const skip of skipped) {
                const pkgInfo = skip.package ? ` from "${skip.package}"` : '';
                console.error(`  - ${skip.name} (${skip.reason})${pkgInfo}`);
              }
            } else {
              console.error(`⚠ ${skipped.length} export(s) skipped (use --verbose for details)`);
            }
          }
        }

        // Check for failures if --verify
        if (options.verify && result.verification && result.verification.failed > 0) {
          const errorOutput = {
            error: 'Export verification failed',
            failed: result.verification.details.failed,
            diagnostics: formatDiagnostics(result.diagnostics),
          };
          console.error(JSON.stringify(errorOutput, null, 2));
          process.exit(1);
        }

        // Output spec
        const specJson = JSON.stringify(result.spec, null, 2);

        if (options.output === '-') {
          // Stdout mode
          console.log(specJson);
        } else {
          // File mode
          const outputPath = path.resolve(options.output ?? 'openpkg.json');
          fs.writeFileSync(outputPath, specJson);
          console.error(`Wrote ${outputPath}`);
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        const errorOutput = {
          error: error.message,
          ...(error.stack && { stack: error.stack }),
        };
        console.error(JSON.stringify(errorOutput, null, 2));
        process.exit(1);
      }
    });
}
