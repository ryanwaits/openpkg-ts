#!/usr/bin/env bun
import { Command } from 'commander';
import pkg from '../package.json';
import { createBreakingCommand } from '../src/commands/breaking';
import { createChangelogCommand } from '../src/commands/changelog';
import { createDiffCommand } from '../src/commands/diff';
import { createDocsCommand } from '../src/commands/docs';
import { createSemverCommand } from '../src/commands/semver';
import { createSpecCommand } from '../src/commands/spec';

const program = new Command();

program
  .name('openpkg')
  .description('OpenPkg CLI - TypeScript API extraction primitives')
  .version(pkg.version);

// =============================================================================
// Parent commands: spec, docs
// =============================================================================
program.addCommand(createSpecCommand());
program.addCommand(createDocsCommand());

// =============================================================================
// Version commands (flat)
// =============================================================================
program.addCommand(createDiffCommand());
program.addCommand(createBreakingCommand());
program.addCommand(createChangelogCommand());
program.addCommand(createSemverCommand());

// =============================================================================
// Backwards-compat aliases
// =============================================================================
const specCmd = program.commands.find((c) => c.name() === 'spec');
if (!specCmd) {
  throw new Error('Internal error: spec command not found');
}

/** Helper to get a subcommand safely */
function getSubcommand(parent: Command, name: string): Command {
  const cmd = parent.commands.find((c) => c.name() === name);
  if (!cmd) {
    throw new Error(`Internal error: ${name} subcommand not found`);
  }
  return cmd;
}

/** Create an alias command that forwards to a subcommand */
function createAlias(aliasName: string, targetName: string, description: string): Command {
  return new Command(aliasName)
    .description(description)
    .allowUnknownOption()
    .allowExcessArguments()
    .action(async () => {
      const args = process.argv.slice(3);
      await getSubcommand(specCmd, targetName).parseAsync(args, { from: 'user' });
    });
}

// openpkg snapshot → openpkg spec snapshot
program.addCommand(createAlias('snapshot', 'snapshot', '(alias) → openpkg spec snapshot'));

// openpkg list → openpkg spec list
program.addCommand(createAlias('list', 'list', '(alias) → openpkg spec list'));

// openpkg get → openpkg spec get
program.addCommand(createAlias('get', 'get', '(alias) → openpkg spec get'));

// openpkg validate → openpkg spec validate
program.addCommand(createAlias('validate', 'validate', '(alias) → openpkg spec validate'));

// openpkg filter → openpkg spec filter
program.addCommand(createAlias('filter', 'filter', '(alias) → openpkg spec filter'));

// openpkg diagnostics → openpkg spec lint (renamed)
program.addCommand(createAlias('diagnostics', 'lint', '(alias) → openpkg spec lint'));

program.parse();
