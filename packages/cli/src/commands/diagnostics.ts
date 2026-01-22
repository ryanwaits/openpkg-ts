import * as fs from 'node:fs';
import * as path from 'node:path';
import { analyzeSpec, type SpecDiagnostics } from '@openpkg-ts/sdk';
import type { OpenPkg, SpecGenerationMeta, SpecSkippedExport } from '@openpkg-ts/spec';
import { Command } from 'commander';

export interface DiagnosticsResult {
  summary: {
    total: number;
    missingDescriptions: number;
    deprecatedNoReason: number;
    missingParamDocs: number;
    skippedExports?: number;
    externalExports?: number;
  };
  diagnostics: SpecDiagnostics;
  skippedExports?: {
    total: number;
    byReason: Record<string, number>;
    details?: SpecSkippedExport[];
  };
  externalExports?: {
    count: number;
    details?: Array<{ name: string; package?: string }>;
  };
}

interface DiagnosticsOptions {
  verbose?: boolean;
}

function loadJSON(filePath: string): unknown {
  const resolved = path.resolve(filePath);
  const content = fs.readFileSync(resolved, 'utf-8');
  return JSON.parse(content);
}

export function createDiagnosticsCommand(): Command {
  return new Command('diagnostics')
    .description('Analyze spec for quality issues (missing docs, deprecated without reason)')
    .argument('<spec>', 'Path to spec file (JSON)')
    .option('--verbose', 'Show detailed information including skipped export details')
    .action(async (specPath: string, options: DiagnosticsOptions) => {
      try {
        const spec = loadJSON(specPath) as OpenPkg;

        const diagnostics = analyzeSpec(spec);

        // Get skipped exports from generation metadata
        const generation = spec.generation as SpecGenerationMeta | undefined;
        const skipped = generation?.skipped ?? [];

        // Count external exports
        const externalExports = spec.exports.filter((e) => e.kind === 'external');

        // Group skipped by reason
        const byReason: Record<string, number> = {};
        for (const skip of skipped) {
          byReason[skip.reason] = (byReason[skip.reason] ?? 0) + 1;
        }

        const result: DiagnosticsResult = {
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
          // Include skipped exports info
          ...(skipped.length > 0 && {
            skippedExports: {
              total: skipped.length,
              byReason,
              ...(options.verbose && { details: skipped }),
            },
          }),
          // Include external exports info
          ...(externalExports.length > 0 && {
            externalExports: {
              count: externalExports.length,
              ...(options.verbose && {
                details: externalExports.map((e) => ({
                  name: e.name,
                  package: e.source?.package,
                })),
              }),
            },
          }),
        };

        console.log(JSON.stringify(result, null, 2));
        // Always exit 0 - informational only
        process.exit(0);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        console.log(JSON.stringify({ error: error.message }, null, 2));
        process.exit(0);
      }
    });
}
