import { spawn } from 'node:child_process';
import { Command } from 'commander';
import { getShadcnCommand } from './utils';

export function createViewCommand(): Command {
  return new Command('view')
    .description('View @openpkg component before installing (wrapper for shadcn view)')
    .argument('<components...>', 'Components to view')
    .option('-c, --cwd <cwd>', 'Working directory')
    .action(async (components: string[], options: { cwd?: string }) => {
      // Prefix components with @openpkg/ if not already namespaced
      const prefixedComponents = components.map((c) => (c.startsWith('@') ? c : `@openpkg/${c}`));

      const extraArgs = [...prefixedComponents];
      if (options.cwd) extraArgs.push('-c', options.cwd);

      const { cmd, args } = getShadcnCommand('view', extraArgs);

      const child = spawn(cmd, args, {
        stdio: 'inherit',
        shell: true,
      });

      child.on('close', (code) => {
        process.exit(code || 0);
      });
    });
}
