import * as fs from 'node:fs';
import * as path from 'node:path';
import { getValidationErrors, type SchemaVersion, type SpecError } from '@openpkg-ts/spec';
import { Command } from 'commander';

export type ValidateResult = {
  valid: boolean;
  errors: SpecError[];
};

function loadJSON(filePath: string): unknown {
  const resolved = path.resolve(filePath);
  const content = fs.readFileSync(resolved, 'utf-8');
  return JSON.parse(content);
}

export function createValidateCommand(): Command {
  return new Command('validate')
    .description('Validate an OpenPkg spec against the schema')
    .argument('<spec>', 'Path to spec file (JSON)')
    .option('--version <version>', 'Schema version to validate against (default: latest)')
    .action(async (specPath: string, options: { version?: string }) => {
      try {
        const spec = loadJSON(specPath);
        const version = (options.version ?? 'latest') as SchemaVersion;

        const errors = getValidationErrors(spec, version);

        const result: ValidateResult = {
          valid: errors.length === 0,
          errors,
        };

        console.log(JSON.stringify(result, null, 2));

        if (errors.length > 0) {
          process.exit(1);
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        console.error(JSON.stringify({ error: error.message }, null, 2));
        process.exit(1);
      }
    });
}
