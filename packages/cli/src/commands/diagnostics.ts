import * as fs from 'node:fs';
import * as path from 'node:path';
import { analyzeSpec, type SpecDiagnostics } from '@openpkg-ts/sdk';
import type { OpenPkg } from '@openpkg-ts/spec';
import { Command } from 'commander';

export interface DiagnosticsResult {
  summary: {
    total: number;
    missingDescriptions: number;
    deprecatedNoReason: number;
    missingParamDocs: number;
  };
  diagnostics: SpecDiagnostics;
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
    .action(async (specPath: string) => {
      try {
        const spec = loadJSON(specPath) as OpenPkg;

        const diagnostics = analyzeSpec(spec);

        const result: DiagnosticsResult = {
          summary: {
            total:
              diagnostics.missingDescriptions.length +
              diagnostics.deprecatedNoReason.length +
              diagnostics.missingParamDocs.length,
            missingDescriptions: diagnostics.missingDescriptions.length,
            deprecatedNoReason: diagnostics.deprecatedNoReason.length,
            missingParamDocs: diagnostics.missingParamDocs.length,
          },
          diagnostics,
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
