import * as fs from 'node:fs';
import * as path from 'node:path';
import { createDocs, type DocsInstance, loadSpec } from '@openpkg-ts/sdk';
import type { OpenPkg } from '@openpkg-ts/spec';
import { Command } from 'commander';

type OutputFormat = 'md' | 'json' | 'html';

interface DocsCommandOptions {
  output?: string;
  format?: OutputFormat;
  split?: boolean;
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
    default:
      return '.md';
  }
}

function renderExport(docs: DocsInstance, exportId: string, format: OutputFormat): string {
  const exp = docs.getExport(exportId);
  if (!exp) throw new Error(`Export not found: ${exportId}`);

  switch (format) {
    case 'json':
      return JSON.stringify(docs.toJSON({ exportId }), null, 2);
    case 'html':
      return docs.toHTML({ exportId });
    default:
      return docs.toMarkdown({ exportId, frontmatter: true, codeSignatures: true });
  }
}

function renderFull(docs: DocsInstance, format: OutputFormat): string {
  switch (format) {
    case 'json':
      return JSON.stringify(docs.toJSON(), null, 2);
    case 'html':
      return docs.toHTML();
    default:
      return docs.toMarkdown({ frontmatter: true, codeSignatures: true });
  }
}

export function createDocsCommand(): Command {
  return new Command('docs')
    .description('Generate documentation from OpenPkg spec')
    .argument('<spec>', 'Path to openpkg.json spec file (use - for stdin)')
    .option('-o, --output <path>', 'Output file or directory (default: stdout)')
    .option('-f, --format <format>', 'Output format: md, json, html (default: md)', 'md')
    .option('--split', 'Output one file per export (requires --output as directory)')
    .action(async (specPath: string, options: DocsCommandOptions) => {
      const format = (options.format || 'md') as OutputFormat;

      try {
        let docs: DocsInstance;

        // Handle stdin
        if (specPath === '-') {
          const input = await readStdin();
          const spec: OpenPkg = JSON.parse(input);
          docs = loadSpec(spec);
        } else {
          const specFile = path.resolve(specPath);
          if (!fs.existsSync(specFile)) {
            console.error(JSON.stringify({ error: `Spec file not found: ${specFile}` }));
            process.exit(1);
          }
          docs = createDocs(specFile);
        }

        // Split mode: one file per export
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
            const content = renderExport(docs, exp.id, format);
            fs.writeFileSync(filePath, content);
          }
          console.error(`Wrote ${exports.length} files to ${outDir}`);
          return;
        }

        // Single output mode
        const output = renderFull(docs, format);

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
