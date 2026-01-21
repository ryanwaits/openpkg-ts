import * as fs from 'node:fs';
import * as path from 'node:path';
import { type FilterCriteria, filterSpec } from '@openpkg-ts/sdk';
import type { OpenPkg, SpecExportKind } from '@openpkg-ts/spec';
import { Command } from 'commander';

const VALID_KINDS: SpecExportKind[] = [
  'function',
  'class',
  'variable',
  'interface',
  'type',
  'enum',
  'module',
  'namespace',
  'reference',
  'external',
];

export type FilterResult = {
  spec: OpenPkg;
  matched: number;
  total: number;
};

export type FilterSummaryResult = {
  matched: number;
  total: number;
};

function loadSpec(filePath: string): OpenPkg {
  const resolved = path.resolve(filePath);
  const content = fs.readFileSync(resolved, 'utf-8');
  return JSON.parse(content) as OpenPkg;
}

function parseList(val?: string): string[] | undefined {
  if (!val) return undefined;
  return val
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function validateKinds(kinds: string[]): SpecExportKind[] {
  const invalid = kinds.filter((k) => !VALID_KINDS.includes(k as SpecExportKind));
  if (invalid.length > 0) {
    throw new Error(
      `Invalid kind(s): ${invalid.join(', ')}. Valid kinds: ${VALID_KINDS.join(', ')}`,
    );
  }
  return kinds as SpecExportKind[];
}

export function createFilterCommand(): Command {
  return new Command('filter')
    .description('Filter an OpenPkg spec by various criteria')
    .argument('<spec>', 'Path to spec file (JSON)')
    .option('--kind <kinds>', 'Filter by kinds (comma-separated)')
    .option('--name <names>', 'Filter by exact names (comma-separated)')
    .option('--id <ids>', 'Filter by IDs (comma-separated)')
    .option('--tag <tags>', 'Filter by tags (comma-separated)')
    .option('--deprecated', 'Only deprecated exports')
    .option('--no-deprecated', 'Exclude deprecated exports')
    .option('--has-description', 'Only exports with descriptions')
    .option('--missing-description', 'Only exports without descriptions')
    .option('--search <term>', 'Search name/description (case-insensitive)')
    .option('--search-members', 'Also search member names/descriptions')
    .option('--search-docs', 'Also search param/return descriptions and examples')
    .option('--module <path>', 'Filter by source file path (contains)')
    .option('-o, --output <file>', 'Output file (default: stdout)')
    .option('--summary', 'Only output matched/total counts')
    .option('--quiet', 'Output raw spec only (no wrapper)')
    .action(
      async (
        specPath: string,
        options: {
          kind?: string;
          name?: string;
          id?: string;
          tag?: string;
          deprecated?: boolean;
          hasDescription?: boolean;
          missingDescription?: boolean;
          search?: string;
          searchMembers?: boolean;
          searchDocs?: boolean;
          module?: string;
          output?: string;
          summary?: boolean;
          quiet?: boolean;
        },
      ) => {
        try {
          const spec = loadSpec(specPath);

          const criteria: FilterCriteria = {};

          if (options.kind) {
            const kinds = parseList(options.kind);
            if (kinds) criteria.kinds = validateKinds(kinds);
          }
          if (options.name) criteria.names = parseList(options.name);
          if (options.id) criteria.ids = parseList(options.id);
          if (options.tag) criteria.tags = parseList(options.tag);
          if (options.deprecated !== undefined) criteria.deprecated = options.deprecated;
          if (options.hasDescription) criteria.hasDescription = true;
          if (options.missingDescription) criteria.hasDescription = false;
          if (options.search) criteria.search = options.search;
          if (options.searchMembers) criteria.searchMembers = true;
          if (options.searchDocs) criteria.searchDocs = true;
          if (options.module) criteria.module = options.module;

          const result = filterSpec(spec, criteria);

          let output: OpenPkg | FilterResult | FilterSummaryResult;
          if (options.summary) {
            output = { matched: result.matched, total: result.total };
          } else if (options.quiet) {
            output = result.spec;
          } else {
            output = { spec: result.spec, matched: result.matched, total: result.total };
          }

          const json = JSON.stringify(output, null, 2);

          if (options.output) {
            fs.writeFileSync(path.resolve(options.output), json);
          } else {
            console.log(json);
          }
        } catch (err) {
          const error = err instanceof Error ? err : new Error(String(err));
          console.error(JSON.stringify({ error: error.message }, null, 2));
          process.exit(1);
        }
      },
    );
}
