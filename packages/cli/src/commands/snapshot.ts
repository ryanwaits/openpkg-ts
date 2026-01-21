import * as fs from 'node:fs';
import * as path from 'node:path';
import { type Diagnostic, type ExtractOptions, extractSpec } from '@openpkg-ts/sdk';
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
    .description('Generate full OpenPkg spec from TypeScript entry point')
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
    .action(async (entry: string, options: SnapshotCommandOptions) => {
      const entryFile = path.resolve(entry);

      const extractOptions: ExtractOptions = {
        entryFile,
        maxTypeDepth: parseInt(options.maxDepth ?? '4', 10),
        resolveExternalTypes: !options.skipResolve,
        schemaExtraction: options.runtime ? 'hybrid' : 'static',
        only: parseFilter(options.only),
        ignore: parseFilter(options.ignore),
        includePrivate: options.includePrivate,
      };

      try {
        const result = await extractSpec(extractOptions);

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
