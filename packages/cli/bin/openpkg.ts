#!/usr/bin/env bun
import * as path from 'node:path';
import { getExport, listExports } from '@openpkg-ts/sdk';
import { Command } from 'commander';
import pkg from '../package.json';
import { createDiffCommand } from '../src/commands/diff';
import { createDocsCommand } from '../src/commands/docs';
import { createSnapshotCommand } from '../src/commands/snapshot';

const program = new Command();

program
  .name('openpkg')
  .description('OpenPkg CLI - TypeScript API extraction primitives')
  .version(pkg.version);

program
  .command('list')
  .description('List exports from a TypeScript entry point')
  .argument('<entry>', 'Entry point file path')
  .action(async (entry: string) => {
    const entryFile = path.resolve(entry);
    const result = await listExports({ entryFile });

    if (result.errors.length > 0) {
      console.error(JSON.stringify({ errors: result.errors }, null, 2));
      process.exit(1);
    }

    console.log(JSON.stringify(result.exports, null, 2));
  });

program
  .command('get')
  .description('Get detailed spec for a single export')
  .argument('<entry>', 'Entry point file path')
  .argument('<name>', 'Export name')
  .action(async (entry: string, name: string) => {
    const entryFile = path.resolve(entry);
    const result = await getExport({ entryFile, exportName: name });

    if (!result.export) {
      const errorMsg =
        result.errors.length > 0 ? result.errors.join('; ') : `Export '${name}' not found`;
      console.error(JSON.stringify({ error: errorMsg }, null, 2));
      process.exit(1);
    }

    // Output export with related types if any
    const output: Record<string, unknown> = { export: result.export };
    if (result.types.length > 0) {
      output.types = result.types;
    }
    console.log(JSON.stringify(output, null, 2));
  });

program.addCommand(createSnapshotCommand());
program.addCommand(createDiffCommand());
program.addCommand(createDocsCommand());

program.parse();
