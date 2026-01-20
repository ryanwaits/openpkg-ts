import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  type CategorizedBreaking,
  categorizeBreakingChanges,
  diffSpec,
  type OpenPkg,
} from '@openpkg-ts/spec';
import { Command } from 'commander';

export type BreakingResult = {
  breaking: CategorizedBreaking[];
  count: number;
};

function loadSpec(filePath: string): OpenPkg {
  const resolved = path.resolve(filePath);
  const content = fs.readFileSync(resolved, 'utf-8');
  return JSON.parse(content) as OpenPkg;
}

export function createBreakingCommand(): Command {
  return new Command('breaking')
    .description('Check for breaking changes between two specs')
    .argument('<old>', 'Path to old spec file (JSON)')
    .argument('<new>', 'Path to new spec file (JSON)')
    .action(async (oldPath: string, newPath: string) => {
      try {
        const oldSpec = loadSpec(oldPath);
        const newSpec = loadSpec(newPath);

        const diff = diffSpec(oldSpec, newSpec);
        const categorized = categorizeBreakingChanges(diff.breaking, oldSpec, newSpec);

        const result: BreakingResult = {
          breaking: categorized,
          count: categorized.length,
        };

        console.log(JSON.stringify(result, null, 2));

        if (categorized.length > 0) {
          process.exit(1);
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        console.error(JSON.stringify({ error: error.message }, null, 2));
        process.exit(1);
      }
    });
}
