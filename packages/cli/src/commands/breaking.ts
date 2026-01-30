import {
  type CategorizedBreaking,
  categorizeBreakingChanges,
  diffSpec,
} from '@openpkg-ts/spec';
import { Command } from 'commander';
import { handleCommandError, loadSpec } from './utils';

export type BreakingResult = {
  breaking: CategorizedBreaking[];
  count: number;
};

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
        handleCommandError(err);
      }
    });
}
