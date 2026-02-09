/**
 * List exports from a TypeScript entry point
 */
import * as path from 'node:path';
import ts from 'typescript';
import { getExportKind, isSymbolDeprecated } from '../ast/utils';
import { createProgram } from '../compiler/program';

export interface ListExportsOptions {
  /** Entry point file path */
  entryFile: string;
  /** Base directory for resolution */
  baseDir?: string;
  /** Optional in-memory content (for testing) */
  content?: string;
}

export interface ExportItem {
  /** Export name */
  name: string;
  /** Export kind */
  kind: 'function' | 'class' | 'interface' | 'type' | 'enum' | 'variable' | 'namespace' | 'external';
  /** Source file path */
  file: string;
  /** Line number (1-indexed) */
  line: number;
  /** JSDoc description (first line, max 80 chars) */
  description?: string;
  /** Whether export is deprecated */
  deprecated?: boolean;
  /** Whether this is a re-export from another module */
  reexport?: boolean;
}

export interface ListExportsResult {
  exports: ExportItem[];
  errors: string[];
}

/**
 * List all exports from a TypeScript entry point
 */
export async function listExports(options: ListExportsOptions): Promise<ListExportsResult> {
  const { entryFile, baseDir, content } = options;
  const errors: string[] = [];
  const exports: ExportItem[] = [];

  const result = createProgram({ entryFile, baseDir, content });
  const { program, sourceFile } = result;

  if (!sourceFile) {
    return { exports: [], errors: [`Entry file not found: ${entryFile}. Specify with: drift list src/index.ts`] };
  }

  const checker = program.getTypeChecker();
  const moduleSymbol = checker.getSymbolAtLocation(sourceFile);

  if (!moduleSymbol) {
    return { exports: [], errors: [`No exports found in ${entryFile}. Is this the right entry point?`] };
  }

  const exportedSymbols = checker.getExportsOfModule(moduleSymbol);

  for (const symbol of exportedSymbols) {
    try {
      const exportItem = extractExportItem(symbol, checker, entryFile, sourceFile);
      if (exportItem) {
        exports.push(exportItem);
      }
    } catch (err) {
      errors.push(
        `Failed to extract '${symbol.getName()}': ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // Sort by name
  exports.sort((a, b) => a.name.localeCompare(b.name));

  return { exports, errors };
}

function extractExportItem(
  symbol: ts.Symbol,
  checker: ts.TypeChecker,
  entryFile: string,
  entrySourceFile: ts.SourceFile,
): ExportItem | null {
  const name = symbol.getName();

  // Detect re-export before resolving alias
  const isReexport = !!(symbol.flags & ts.SymbolFlags.Alias);

  // Resolve alias
  let targetSymbol = symbol;
  if (symbol.flags & ts.SymbolFlags.Alias) {
    const aliased = checker.getAliasedSymbol(symbol);
    if (aliased && aliased !== symbol) {
      targetSymbol = aliased;
    }
  }

  const declarations = targetSymbol.declarations ?? [];
  const declaration =
    targetSymbol.valueDeclaration ||
    declarations.find((d) => d.kind !== ts.SyntaxKind.ExportSpecifier) ||
    declarations[0];

  if (!declaration) {
    // No declaration found — likely an external re-export that couldn't be resolved
    return {
      name,
      kind: 'external' as const,
      file: '<external>',
      line: 0,
      reexport: true,
    };
  }

  // Handle namespace re-exports (export * as X from './module')
  // These resolve to SourceFile declarations - handle specially
  if (ts.isSourceFile(declaration)) {
    return {
      name,
      kind: 'namespace' as const,
      file: path.relative(path.dirname(entryFile), declaration.fileName),
      line: 1,
      reexport: true,
    };
  }

  // Get kind
  const kind = getExportKind(declaration, checker.getTypeAtLocation(declaration));

  // Get location
  const sourceFile = declaration.getSourceFile();
  const { line } = sourceFile.getLineAndCharacterOfPosition(declaration.getStart());

  // Get description (truncated to 80 chars)
  const description = getDescriptionPreview(targetSymbol, checker);

  // Check deprecated
  const { deprecated } = isSymbolDeprecated(targetSymbol);

  // Check if from different file (re-export)
  const reexport = isReexport || sourceFile !== entrySourceFile;

  return {
    name,
    kind,
    file: path.relative(path.dirname(entryFile), sourceFile.fileName),
    line: line + 1, // 1-indexed
    ...(description ? { description } : {}),
    ...(deprecated ? { deprecated: true } : {}),
    ...(reexport ? { reexport: true } : {}),
  };
}

function getDescriptionPreview(symbol: ts.Symbol, checker: ts.TypeChecker): string | undefined {
  const docs = symbol.getDocumentationComment(checker);
  if (docs.length === 0) return undefined;

  const fullText = docs.map((d) => d.text).join('');
  const firstLine = fullText.split('\n')[0].trim();
  if (!firstLine) return undefined;

  // Truncate at 80 chars
  if (firstLine.length <= 80) return firstLine;
  return `${firstLine.slice(0, 77)}...`;
}
