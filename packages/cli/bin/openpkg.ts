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
const specCmd = program.commands.find((c) => c.name() === 'spec')!;

// openpkg snapshot → openpkg spec snapshot
const snapshotAlias = new Command('snapshot')
  .description('(alias) → openpkg spec snapshot')
  .allowUnknownOption()
  .allowExcessArguments()
  .action(async () => {
    const args = process.argv.slice(3);
    await specCmd.commands.find((c) => c.name() === 'snapshot')!.parseAsync(args, { from: 'user' });
  });
program.addCommand(snapshotAlias);

// openpkg list → openpkg spec list
const listAlias = new Command('list')
  .description('(alias) → openpkg spec list')
  .allowUnknownOption()
  .allowExcessArguments()
  .action(async () => {
    const args = process.argv.slice(3);
    await specCmd.commands.find((c) => c.name() === 'list')!.parseAsync(args, { from: 'user' });
  });
program.addCommand(listAlias);

// openpkg get → openpkg spec get
const getAlias = new Command('get')
  .description('(alias) → openpkg spec get')
  .allowUnknownOption()
  .allowExcessArguments()
  .action(async () => {
    const args = process.argv.slice(3);
    await specCmd.commands.find((c) => c.name() === 'get')!.parseAsync(args, { from: 'user' });
  });
program.addCommand(getAlias);

// openpkg validate → openpkg spec validate
const validateAlias = new Command('validate')
  .description('(alias) → openpkg spec validate')
  .allowUnknownOption()
  .allowExcessArguments()
  .action(async () => {
    const args = process.argv.slice(3);
    await specCmd.commands.find((c) => c.name() === 'validate')!.parseAsync(args, { from: 'user' });
  });
program.addCommand(validateAlias);

// openpkg filter → openpkg spec filter
const filterAlias = new Command('filter')
  .description('(alias) → openpkg spec filter')
  .allowUnknownOption()
  .allowExcessArguments()
  .action(async () => {
    const args = process.argv.slice(3);
    await specCmd.commands.find((c) => c.name() === 'filter')!.parseAsync(args, { from: 'user' });
  });
program.addCommand(filterAlias);

// openpkg diagnostics → openpkg spec lint (renamed)
const diagnosticsAlias = new Command('diagnostics')
  .description('(alias) → openpkg spec lint')
  .allowUnknownOption()
  .allowExcessArguments()
  .action(async () => {
    const args = process.argv.slice(3);
    await specCmd.commands.find((c) => c.name() === 'lint')!.parseAsync(args, { from: 'user' });
  });
program.addCommand(diagnosticsAlias);

program.parse();
