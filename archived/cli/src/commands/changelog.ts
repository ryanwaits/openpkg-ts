import { Command } from 'commander';
import { type DiffResult, enrichDiff } from './diff';
import { handleCommandError, loadSpec } from './utils';

/**
 * Format diff result as markdown changelog
 */
function formatMarkdown(diff: DiffResult): string {
  const lines: string[] = [];

  // Breaking Changes
  if (diff.removed.length > 0 || diff.changed.length > 0) {
    lines.push('## Breaking Changes');
    lines.push('');
    for (const r of diff.removed) {
      lines.push(`- **Removed** \`${r.name}\` (${r.kind})`);
    }
    for (const c of diff.changed) {
      lines.push(`- **${c.name}** (${c.kind}): ${c.description}`);
    }
    lines.push('');
  }

  // Added
  if (diff.added.length > 0) {
    lines.push('## Added');
    lines.push('');
    for (const id of diff.added) {
      lines.push(`- \`${id}\``);
    }
    lines.push('');
  }

  // Changed (docs only)
  if (diff.docsOnly.length > 0) {
    lines.push('## Changed');
    lines.push('');
    for (const id of diff.docsOnly) {
      lines.push(`- \`${id}\` (docs)`);
    }
    lines.push('');
  }

  return lines.join('\n').trim() || 'No changes detected.';
}

export function createChangelogCommand(): Command {
  return new Command('changelog')
    .description('Generate changelog from diff between two specs')
    .argument('<old>', 'Path to old spec file (JSON)')
    .argument('<new>', 'Path to new spec file (JSON)')
    .option('--format <format>', 'Output format: md or json', 'md')
    .action(async (oldPath: string, newPath: string, options: { format?: string }) => {
      try {
        const oldSpec = loadSpec(oldPath);
        const newSpec = loadSpec(newPath);

        const diff = enrichDiff(oldSpec, newSpec);

        if (options.format === 'json') {
          console.log(JSON.stringify(diff, null, 2));
        } else {
          console.log(formatMarkdown(diff));
        }
      } catch (err) {
        handleCommandError(err);
      }
    });
}
