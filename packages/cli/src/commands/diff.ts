import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  type CategorizedBreaking,
  categorizeBreakingChanges,
  diffSpec,
  type OpenPkg,
  recommendSemverBump,
  type SemverBump,
  type SpecExportKind,
} from '@openpkg-ts/spec';
import { Command } from 'commander';

/**
 * A changed export with details about what changed
 */
export interface ChangedExport {
  id: string;
  name: string;
  kind: SpecExportKind;
  description: string;
}

/**
 * Enriched diff result with categorized changes
 */
export interface DiffResult {
  breaking: CategorizedBreaking[];
  added: string[];
  removed: RemovedExport[];
  changed: ChangedExport[];
  docsOnly: string[];
  summary: {
    breakingCount: number;
    addedCount: number;
    removedCount: number;
    changedCount: number;
    docsOnlyCount: number;
    semverBump: SemverBump;
    semverReason: string;
  };
}

export interface RemovedExport {
  id: string;
  name: string;
  kind: SpecExportKind;
}

function loadSpec(filePath: string): OpenPkg {
  const resolved = path.resolve(filePath);
  const content = fs.readFileSync(resolved, 'utf-8');
  return JSON.parse(content) as OpenPkg;
}

function toExportMap(spec: OpenPkg): Map<string, { name: string; kind: SpecExportKind }> {
  const map = new Map<string, { name: string; kind: SpecExportKind }>();
  for (const exp of spec.exports) {
    map.set(exp.id, { name: exp.name, kind: exp.kind });
  }
  if (spec.types) {
    for (const t of spec.types) {
      map.set(t.id, { name: t.name, kind: t.kind as SpecExportKind });
    }
  }
  return map;
}

/**
 * Enriches basic diffSpec output with categorization
 */
export function enrichDiff(oldSpec: OpenPkg, newSpec: OpenPkg): DiffResult {
  const rawDiff = diffSpec(oldSpec, newSpec);
  const categorized = categorizeBreakingChanges(rawDiff.breaking, oldSpec, newSpec);
  const semver = recommendSemverBump(rawDiff);

  const oldExports = toExportMap(oldSpec);

  // Separate removed from changed
  const removed: RemovedExport[] = [];
  const changed: ChangedExport[] = [];
  const breaking: CategorizedBreaking[] = [];

  for (const cat of categorized) {
    if (cat.reason === 'removed') {
      const info = oldExports.get(cat.id);
      removed.push({
        id: cat.id,
        name: cat.name,
        kind: info?.kind ?? cat.kind,
      });
    } else {
      // It's a change, not a removal
      changed.push({
        id: cat.id,
        name: cat.name,
        kind: cat.kind,
        description: describeChange(cat),
      });
      breaking.push(cat);
    }
  }

  // Added exports
  const added = rawDiff.nonBreaking;

  return {
    breaking,
    added,
    removed,
    changed,
    docsOnly: rawDiff.docsOnly,
    summary: {
      breakingCount: breaking.length,
      addedCount: added.length,
      removedCount: removed.length,
      changedCount: changed.length,
      docsOnlyCount: rawDiff.docsOnly.length,
      semverBump: semver.bump,
      semverReason: semver.reason,
    },
  };
}

/**
 * Generate human-readable description for a change
 */
function describeChange(cat: CategorizedBreaking): string {
  switch (cat.reason) {
    case 'signature changed':
      return `Function signature changed`;
    case 'type definition changed':
      return `Type definition changed`;
    case 'constructor changed':
      return `Class constructor signature changed`;
    case 'methods removed':
      return `Class methods removed`;
    case 'methods changed':
      return `Class methods changed`;
    case 'changed':
      return `${cat.kind} changed`;
    default:
      return cat.reason;
  }
}

export function createDiffCommand(): Command {
  return new Command('diff')
    .description('Compare two OpenPkg specs and show differences')
    .argument('<old>', 'Path to old spec file (JSON)')
    .argument('<new>', 'Path to new spec file (JSON)')
    .option('--json', 'Output as JSON (default)')
    .option('--summary', 'Only show summary')
    .action(
      async (oldPath: string, newPath: string, options: { json?: boolean; summary?: boolean }) => {
        try {
          const oldSpec = loadSpec(oldPath);
          const newSpec = loadSpec(newPath);

          const result = enrichDiff(oldSpec, newSpec);

          if (options.summary) {
            console.log(JSON.stringify(result.summary, null, 2));
          } else {
            console.log(JSON.stringify(result, null, 2));
          }
        } catch (err) {
          const error = err instanceof Error ? err : new Error(String(err));
          console.error(JSON.stringify({ error: error.message }, null, 2));
          process.exit(1);
        }
      },
    );
}
