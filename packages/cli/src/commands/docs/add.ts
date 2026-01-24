import { spawn } from 'node:child_process';
import { Command } from 'commander';
import { getShadcnCommand } from './utils';

export function createAddCommand(): Command {
  return new Command('add')
    .description('Install @openpkg components (wrapper for shadcn add)')
    .argument('<components...>', 'Components to install')
    .option('-o, --overwrite', 'Overwrite existing files')
    .option('-c, --cwd <path>', 'Working directory')
    .option('-y, --yes', 'Skip confirmation prompt')
    .option('-s, --silent', 'Mute output')
    .action(
      async (
        components: string[],
        options: { overwrite?: boolean; cwd?: string; yes?: boolean; silent?: boolean },
      ) => {
        // Prefix components with @openpkg/ if not already namespaced
        const prefixedComponents = components.map((c) => (c.startsWith('@') ? c : `@openpkg/${c}`));

        const extraArgs: string[] = [];
        if (options.overwrite) extraArgs.push('--overwrite');
        if (options.cwd) extraArgs.push('--cwd', options.cwd);
        if (options.yes) extraArgs.push('--yes');
        if (options.silent) extraArgs.push('--silent');

        const { cmd, args } = getShadcnCommand('add', [...prefixedComponents, ...extraArgs]);

        if (!options.silent) {
          console.log(`Running: ${cmd} ${args.join(' ')}`);
          console.log('');
        }

        const child = spawn(cmd, args, {
          stdio: 'inherit',
          shell: true,
        });

        child.on('close', (code) => {
          process.exit(code || 0);
        });
      },
    );
}
