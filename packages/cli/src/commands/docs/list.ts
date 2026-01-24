import { spawn } from 'node:child_process';
import { Command } from 'commander';
import { getShadcnCommand } from './utils';

export function createListCommand(): Command {
  return new Command('list')
    .description('List @openpkg components (wrapper for shadcn list)')
    .option('-q, --query <query>', 'Search query')
    .option('-l, --limit <number>', 'Max items to display')
    .option('-c, --cwd <cwd>', 'Working directory')
    .action(async (options: { query?: string; limit?: string; cwd?: string }) => {
      const extraArgs: string[] = ['@openpkg'];

      if (options.query) extraArgs.push('-q', options.query);
      if (options.limit) extraArgs.push('-l', options.limit);
      if (options.cwd) extraArgs.push('-c', options.cwd);

      const { cmd, args } = getShadcnCommand('list', extraArgs);

      const child = spawn(cmd, args, {
        stdio: 'inherit',
        shell: true,
      });

      child.on('close', (code) => {
        process.exit(code || 0);
      });
    });
}
