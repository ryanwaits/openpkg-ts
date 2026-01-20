import * as fs from 'node:fs';
import * as path from 'node:path';
import { diffSpec, type OpenPkg, recommendSemverBump, type SemverBump } from '@openpkg-ts/spec';
import { Command } from 'commander';

export type SemverResult = {
  bump: SemverBump;
  reason: string;
};

function loadSpec(filePath: string): OpenPkg {
  const resolved = path.resolve(filePath);
  const content = fs.readFileSync(resolved, 'utf-8');
  return JSON.parse(content) as OpenPkg;
}

export function createSemverCommand(): Command {
  return new Command('semver')
    .description('Recommend semver bump based on spec changes')
    .argument('<old>', 'Path to old spec file (JSON)')
    .argument('<new>', 'Path to new spec file (JSON)')
    .action(async (oldPath: string, newPath: string) => {
      try {
        const oldSpec = loadSpec(oldPath);
        const newSpec = loadSpec(newPath);

        const diff = diffSpec(oldSpec, newSpec);
        const recommendation = recommendSemverBump(diff);

        const result: SemverResult = {
          bump: recommendation.bump,
          reason: recommendation.reason,
        };

        console.log(JSON.stringify(result, null, 2));
        // Always exit 0 - this is a recommendation only
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        console.error(JSON.stringify({ error: error.message }, null, 2));
        process.exit(1);
      }
    });
}
