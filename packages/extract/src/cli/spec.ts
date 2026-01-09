import * as fs from 'node:fs';
import * as path from 'node:path';
import { normalize, validateSpec } from '@openpkg-ts/spec';
import { Command } from 'commander';
import { extract } from '../builder';
import { resolveCompiledPath, detectTsRuntime } from '../schema/standard-schema';
import { spinner, summary } from '../utils/progress';

export function createProgram(): Command {
  const program = new Command('tspec')
    .description('Extract TypeScript package API to OpenPkg spec')
    .argument('[entry]', 'Entry point file')
    .option('-o, --output <file>', 'Output file', 'openpkg.json')
    .option('--max-depth <n>', 'Max type depth (default: 4)')
    .option('--skip-resolve', 'Skip external type resolution')
    .option('--runtime', 'Enable Standard Schema runtime extraction')
    .option(
      '--only <exports>',
      'Only extract these exports (comma-separated, supports * wildcards)',
    )
    .option('--ignore <exports>', 'Ignore these exports (comma-separated, supports * wildcards)')
    .option('-v, --verbose', 'Show detailed output')
    .option('--verify', 'Enable export count verification mode (exit 1 on failures)')
    .action(async (entry, options) => {
      let entryFile: string;
      let fromDts = false;

      if (entry) {
        entryFile = entry;
        fromDts = entry.endsWith('.d.ts');
      } else {
        const found = findEntryPoint(process.cwd());
        if (!found) {
          console.error('No entry point found. Please specify an entry file.');
          process.exit(1);
        }
        entryFile = found.path;
        fromDts = found.fromDts;
      }

      if (fromDts) {
        console.log('Mode: Declaration-only (.d.ts)');
        console.log('  Types and signatures will be extracted');
        console.log('  JSDoc comments unavailable (stripped during compilation)\n');
      }

      // Pre-flight check for --runtime flag
      if (options.runtime) {
        const resolvedEntry = path.resolve(entryFile);
        const baseDir = path.dirname(resolvedEntry);
        const isTs = /\.tsx?$/.test(resolvedEntry);

        if (isTs) {
          const compiledPath = resolveCompiledPath(resolvedEntry, baseDir);
          const tsRuntime = detectTsRuntime();

          if (!compiledPath && !tsRuntime) {
            console.error(`✗ Runtime schema extraction requires compiled JavaScript files.`);
            console.error(`  No .js files found for ${path.basename(entryFile)}.\n`);
            console.error(`  Solutions:`);
            console.error(`  1. Build the project first: npm run build`);
            console.error(`  2. Install a TS runtime: bun, tsx, or ts-node`);
            console.error(`  3. Use Node 22+ for native TypeScript support`);
            console.error(`  4. Remove --runtime flag for static extraction only`);
            process.exit(1);
          }
        }
      }

      const spin = spinner('Extracting...');

      const result = await extract({
        entryFile: path.resolve(entryFile),
        ...(options.maxDepth ? { maxTypeDepth: parseInt(options.maxDepth) } : {}),
        resolveExternalTypes: !options.skipResolve,
        schemaExtraction: options.runtime ? 'hybrid' : 'static',
        ...(options.only ? { only: options.only.split(',').map((s: string) => s.trim()) } : {}),
        ...(options.ignore
          ? { ignore: options.ignore.split(',').map((s: string) => s.trim()) }
          : {}),
        isDtsSource: fromDts,
      });

      const normalized = normalize(result.spec);
      const validation = validateSpec(normalized);

      if (!validation.ok) {
        spin.fail('Extraction failed');
        console.error('Validation errors:');
        for (const err of validation.errors) {
          console.error(`  - ${err.instancePath}: ${err.message}`);
        }
        process.exit(1);
      }

      fs.writeFileSync(options.output, JSON.stringify(normalized, null, 2));
      spin.success(`Extracted to ${options.output}`);

      // Report degraded mode stats
      if (result.degradedMode) {
        const { stats } = result.degradedMode;
        const total = normalized.exports.length;
        console.log('\nExtraction completed in declaration-only mode:');
        console.log(`  ${stats.exportsWithoutDescription}/${total} exports missing descriptions`);
        console.log(`  ${stats.paramsWithoutDocs} parameters without documentation`);
        console.log(`  ${stats.missingExamples} exports without examples`);
      }

      // Report runtime schema extraction results
      if (result.runtimeSchemas) {
        const { extracted, merged, vendors, method } = result.runtimeSchemas;
        const via = method ? ` via ${method}` : '';
        console.log(
          `ℹ Runtime schemas: ${merged}/${extracted} merged (${vendors.join(', ')})${via}`,
        );
      }

      // Report diagnostics (info only with --verbose)
      for (const diag of result.diagnostics) {
        if (diag.severity === 'info' && !options.verbose) continue;
        const prefix = diag.severity === 'error' ? '✗' : diag.severity === 'warning' ? '⚠' : 'ℹ';
        console.log(`${prefix} ${diag.message}`);
      }

      // Render summary
      const sum = summary()
        .addKeyValue('Exports', normalized.exports.length)
        .addKeyValue('Types', normalized.types?.length || 0);
      if (result.runtimeSchemas) {
        sum.addKeyValue('Runtime Schemas', result.runtimeSchemas.merged);
      }

      // Verification output
      if (result.verification) {
        const v = result.verification;
        sum.addKeyValue('Discovered', v.discovered);
        sum.addKeyValue('Extracted', v.extracted);
        if (v.failed > 0) {
          sum.addWithThreshold('Failed', v.failed, { value: 0, operator: '<=' });
        }
      }
      sum.print();

      // Failed exports details
      if (result.verification?.failed) {
        console.log('\nFailed exports:');
        for (const f of result.verification.details.failed) {
          console.log(`  - ${f.name}: ${f.error}`);
        }
      }

      // Skipped exports (verbose only)
      if (options.verbose && result.verification?.details.skipped.length) {
        console.log('\nSkipped exports:');
        for (const s of result.verification.details.skipped) {
          console.log(`  - ${s.name}: ${s.reason}`);
        }
      }

      // Strict verification mode
      if (options.verify && result.verification?.failed) {
        const v = result.verification;
        spin.fail(`Expected ${v.discovered} exports, got ${v.extracted}`);
        process.exit(1);
      }
    });

  return program;
}

interface EntryPointResult {
  path: string;
  fromDts: boolean;
}

function findEntryPoint(cwd: string): EntryPointResult | null {
  // Prefer source files first (convention over configuration)
  // Doc generation needs TSDoc/JSDoc comments which exist in source, not .d.ts
  // Check TS first, then JS
  const sourceEntries = [
    'src/index.ts',
    'index.ts',
    'lib/index.ts',
    'src/index.js',
    'index.js',
    'lib/index.js',
  ];
  for (const entry of sourceEntries) {
    const fullPath = path.join(cwd, entry);
    if (fs.existsSync(fullPath)) return { path: fullPath, fromDts: false };
  }

  // Fallback to package.json fields (may be .d.ts)
  const pkgPath = path.join(cwd, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));

      // Check types/typings field
      if (pkg.types) {
        const p = path.join(cwd, pkg.types);
        return { path: p, fromDts: pkg.types.endsWith('.d.ts') };
      }
      if (pkg.typings) {
        const p = path.join(cwd, pkg.typings);
        return { path: p, fromDts: pkg.typings.endsWith('.d.ts') };
      }

      // Check exports field
      if (pkg.exports?.['.']?.types) {
        const p = path.join(cwd, pkg.exports['.'].types);
        return { path: p, fromDts: pkg.exports['.'].types.endsWith('.d.ts') };
      }

      // Check main field - try .ts version first, then .js directly
      if (pkg.main) {
        const mainTs = pkg.main.replace(/\.js$/, '.ts');
        const tsPath = path.join(cwd, mainTs);
        if (fs.existsSync(tsPath)) return { path: tsPath, fromDts: false };

        // Also check if the .js file itself exists (for pure JS projects)
        const jsPath = path.join(cwd, pkg.main);
        if (pkg.main.endsWith('.js') && fs.existsSync(jsPath)) {
          return { path: jsPath, fromDts: false };
        }
      }
    } catch {
      // Ignore parse errors
    }
  }

  return null;
}
