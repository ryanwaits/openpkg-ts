import { Command } from 'commander';
import { createAddCommand } from './add';
import { createGenerateCommand } from './generate';
import { createInitCommand } from './init';
import { createListCommand } from './list';
import { createViewCommand } from './view';

// =============================================================================
// Docs parent command with subcommands
// =============================================================================

export function createDocsCommand(): Command {
  const docs = new Command('docs').description('Documentation generation and component registry');

  docs.addCommand(createGenerateCommand());
  docs.addCommand(createInitCommand());
  docs.addCommand(createListCommand());
  docs.addCommand(createViewCommand());
  docs.addCommand(createAddCommand());

  return docs;
}
