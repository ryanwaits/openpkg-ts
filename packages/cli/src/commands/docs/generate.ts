import * as fs from 'node:fs';
import * as path from 'node:path';
import { type DocsInstance, loadSpec, query, toReact } from '@openpkg-ts/sdk';
import type { OpenPkg, SpecExportKind } from '@openpkg-ts/spec';
import { Command } from 'commander';

type OutputFormat = 'md' | 'json' | 'html' | 'react';

interface GenerateCommandOptions {
  output?: string;
  format?: OutputFormat;
  split?: boolean;
  export?: string;
  adapter?: string;
  collapseUnions?: string;
  kind?: string;
  tag?: string;
  search?: string;
  deprecated?: boolean;
  noDeprecated?: boolean;
  // React layout options
  variant?: 'full' | 'index';
  componentsPath?: string;
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf-8');
}

function getExtension(format: OutputFormat): string {
  switch (format) {
    case 'json':
      return '.json';
    case 'html':
      return '.html';
    case 'react':
      return '.tsx';
    default:
      return '.md';
  }
}

function applyFilters(spec: OpenPkg, options: GenerateCommandOptions): OpenPkg {
  let qb = query(spec);

  if (options.kind) {
    const kinds = options.kind.split(',').map((k) => k.trim()) as SpecExportKind[];
    qb = qb.byKind(...kinds);
  }

  if (options.tag) {
    const tags = options.tag.split(',').map((t) => t.trim());
    qb = qb.byTag(...tags);
  }

  if (options.search) {
    qb = qb.search(options.search);
  }

  if (options.deprecated === true) {
    qb = qb.deprecated(true);
  } else if (options.deprecated === false) {
    qb = qb.deprecated(false);
  }

  return qb.toSpec();
}

function renderExport(
  docs: DocsInstance,
  exportId: string,
  format: OutputFormat,
  collapseUnionThreshold?: number,
): string {
  const exp = docs.getExport(exportId);
  if (!exp) throw new Error(`Export not found: ${exportId}`);

  switch (format) {
    case 'json':
      return JSON.stringify(docs.toJSON({ export: exportId }), null, 2);
    case 'html':
      return docs.toHTML({ export: exportId });
    default:
      return docs.toMarkdown({
        export: exportId,
        frontmatter: true,
        codeSignatures: true,
        collapseUnionThreshold,
      });
  }
}

function renderFull(
  docs: DocsInstance,
  format: OutputFormat,
  collapseUnionThreshold?: number,
): string {
  switch (format) {
    case 'json':
      return JSON.stringify(docs.toJSON(), null, 2);
    case 'html':
      return docs.toHTML();
    default:
      return docs.toMarkdown({ frontmatter: true, codeSignatures: true, collapseUnionThreshold });
  }
}

export function createGenerateCommand(): Command {
  return new Command('generate')
    .description('Generate documentation from OpenPkg spec')
    .argument('<spec>', 'Path to openpkg.json spec file (use - for stdin)')
    .option('-o, --output <path>', 'Output file or directory (default: stdout)')
    .option('-f, --format <format>', 'Output format: md, json, html, react (default: md)', 'md')
    .option('--split', 'Output one file per export (requires --output as directory)')
    .option('-e, --export <name>', 'Generate docs for a single export by name')
    .option('-a, --adapter <name>', 'Use adapter for generation (default: raw)')
    .option('--collapse-unions <n>', 'Collapse unions with more than N members')
    .option('-k, --kind <kinds>', 'Filter by kind(s), comma-separated')
    .option('-t, --tag <tags>', 'Filter by tag(s), comma-separated')
    .option('-s, --search <term>', 'Search name and description')
    .option('--deprecated', 'Only include deprecated exports')
    .option('--no-deprecated', 'Exclude deprecated exports')
    .option('--variant <variant>', 'React layout variant: full (single page) or index (links)', 'full')
    .option('--components-path <path>', 'React components import path', '@/components/api')
    .action(async (specPath: string, options: GenerateCommandOptions) => {
      const format = (options.format || 'md') as OutputFormat;

      try {
        // Handle adapter mode
        if (options.adapter && options.adapter !== 'raw') {
          let getAdapter: typeof import('@openpkg-ts/adapters').getAdapter;
          try {
            const _adapterModule = await import(`@openpkg-ts/adapters/${options.adapter}`);
            const registryModule = await import('@openpkg-ts/adapters');
            getAdapter = registryModule.getAdapter;
          } catch {
            console.error(JSON.stringify({ error: `Failed to load adapter: ${options.adapter}` }));
            process.exit(1);
          }

          const adapter = getAdapter(options.adapter);
          if (!adapter) {
            console.error(JSON.stringify({ error: `Unknown adapter: ${options.adapter}` }));
            process.exit(1);
          }

          if (!options.output) {
            console.error(JSON.stringify({ error: '--adapter requires --output <directory>' }));
            process.exit(1);
          }

          let spec: OpenPkg;
          if (specPath === '-') {
            const input = await readStdin();
            spec = JSON.parse(input);
          } else {
            const specFile = path.resolve(specPath);
            if (!fs.existsSync(specFile)) {
              console.error(JSON.stringify({ error: `Spec file not found: ${specFile}` }));
              process.exit(1);
            }
            spec = JSON.parse(fs.readFileSync(specFile, 'utf-8'));
          }

          spec = applyFilters(spec, options);

          await adapter.generate(spec, path.resolve(options.output));
          console.error(`Generated docs with ${options.adapter} adapter to ${options.output}`);
          return;
        }

        // Load spec
        let spec: OpenPkg;
        if (specPath === '-') {
          const input = await readStdin();
          spec = JSON.parse(input);
        } else {
          const specFile = path.resolve(specPath);
          if (!fs.existsSync(specFile)) {
            console.error(JSON.stringify({ error: `Spec file not found: ${specFile}` }));
            process.exit(1);
          }
          spec = JSON.parse(fs.readFileSync(specFile, 'utf-8'));
        }

        // Apply filters
        spec = applyFilters(spec, options);

        // Create docs instance from filtered spec
        const docs: DocsInstance = loadSpec(spec);

        // Parse collapse unions threshold
        const collapseUnionThreshold = options.collapseUnions
          ? parseInt(options.collapseUnions, 10)
          : undefined;

        // React format mode - generates a single layout file
        if (format === 'react') {
          if (!options.output) {
            console.error(JSON.stringify({ error: '--format react requires --output <directory>' }));
            process.exit(1);
          }

          const variant = (options.variant === 'index' ? 'index' : 'full') as 'full' | 'index';

          await toReact(spec, {
            outDir: path.resolve(options.output),
            variant,
            componentsPath: options.componentsPath ?? '@/components/api',
          });
          console.error(`Generated React layout to ${options.output}`);
          console.error(`  - page.tsx: Layout file`);
          console.error(`  - openpkg.json: Spec data`);
          console.error(`\nNext: Add components with 'openpkg docs add function-section'`);
          return;
        }

        // Single export mode
        if (options.export) {
          const exports = docs.getAllExports();
          const exp = exports.find((e) => e.name === options.export);
          if (!exp) {
            console.error(JSON.stringify({ error: `Export not found: ${options.export}` }));
            process.exit(1);
          }
          const output = renderExport(docs, exp.id, format, collapseUnionThreshold);
          if (options.output && options.output !== '-') {
            const outputPath = path.resolve(options.output);
            fs.writeFileSync(outputPath, output);
            console.error(`Wrote ${outputPath}`);
          } else {
            console.log(output);
          }
          return;
        }

        // Split mode
        if (options.split) {
          if (!options.output) {
            console.error(JSON.stringify({ error: '--split requires --output <directory>' }));
            process.exit(1);
          }

          const outDir = path.resolve(options.output);
          if (!fs.existsSync(outDir)) {
            fs.mkdirSync(outDir, { recursive: true });
          }

          const exports = docs.getAllExports();
          for (const exp of exports) {
            const filename = `${exp.name}${getExtension(format)}`;
            const filePath = path.join(outDir, filename);
            const content = renderExport(docs, exp.id, format, collapseUnionThreshold);
            fs.writeFileSync(filePath, content);
          }
          console.error(`Wrote ${exports.length} files to ${outDir}`);
          return;
        }

        // Single output mode
        const output = renderFull(docs, format, collapseUnionThreshold);

        if (options.output && options.output !== '-') {
          const outputPath = path.resolve(options.output);
          fs.writeFileSync(outputPath, output);
          console.error(`Wrote ${outputPath}`);
        } else {
          console.log(output);
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        console.error(JSON.stringify({ error: error.message }));
        process.exit(1);
      }
    });
}
