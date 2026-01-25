import type { SpecExport, SpecType } from '@openpkg-ts/spec';
import ts from 'typescript';
import { createProgram } from '../compiler/program';
import { serializeClass } from '../serializers/classes';
import { createContext } from '../serializers/context';
import { serializeEnum } from '../serializers/enums';
import { serializeFunctionExport } from '../serializers/functions';
import { serializeInterface } from '../serializers/interfaces';
import { serializeTypeAlias } from '../serializers/type-aliases';
import { serializeVariable } from '../serializers/variables';
import { normalizeExport, normalizeType } from '../types/schema-normalizer';

export interface GetExportOptions {
  /** Entry point file path */
  entryFile: string;
  /** Export name to get */
  exportName: string;
  /** Base directory for resolution */
  baseDir?: string;
  /** Optional in-memory content (for testing) */
  content?: string;
  /** Max depth for type resolution */
  maxTypeDepth?: number;
}

export interface GetExportResult {
  /** The export spec, or null if not found */
  export: SpecExport | null;
  /** Related types referenced by the export */
  types: SpecType[];
  /** Errors encountered */
  errors: string[];
}

/**
 * Get detailed spec for a single export
 */
export async function getExport(options: GetExportOptions): Promise<GetExportResult> {
  const { entryFile, exportName, baseDir, content, maxTypeDepth } = options;
  const errors: string[] = [];

  const result = createProgram({ entryFile, baseDir, content });
  const { program, sourceFile } = result;

  if (!sourceFile) {
    return { export: null, types: [], errors: [`Could not load source file: ${entryFile}`] };
  }

  const checker = program.getTypeChecker();
  const moduleSymbol = checker.getSymbolAtLocation(sourceFile);

  if (!moduleSymbol) {
    return { export: null, types: [], errors: ['Could not get module symbol'] };
  }

  const exportedSymbols = checker.getExportsOfModule(moduleSymbol);
  const targetSymbol = exportedSymbols.find((s) => s.getName() === exportName);

  if (!targetSymbol) {
    return { export: null, types: [], errors: [`Export '${exportName}' not found`] };
  }

  // Build export IDs set for context
  const exportedIds = new Set<string>();
  for (const sym of exportedSymbols) {
    exportedIds.add(sym.getName());
  }

  const ctx = createContext(program, sourceFile, { maxTypeDepth });
  ctx.exportedIds = exportedIds;

  try {
    const { declaration, resolvedSymbol, isTypeOnly } = resolveExportTarget(targetSymbol, checker);

    if (!declaration) {
      return { export: null, types: [], errors: [`No declaration found for '${exportName}'`] };
    }

    let spec = serializeDeclaration(
      declaration,
      targetSymbol,
      resolvedSymbol,
      exportName,
      ctx,
      isTypeOnly,
    );

    if (!spec) {
      return { export: null, types: [], errors: [`Could not serialize '${exportName}'`] };
    }

    // Normalize the export
    spec = normalizeExport(spec, { dialect: 'draft-2020-12' }) as SpecExport;

    // Get types referenced
    const types = ctx.typeRegistry
      .getAll()
      .map((t) => normalizeType(t, { dialect: 'draft-2020-12' }));

    return { export: spec, types, errors };
  } catch (err) {
    errors.push(
      `Failed to serialize '${exportName}': ${err instanceof Error ? err.message : String(err)}`,
    );
    return { export: null, types: [], errors };
  }
}

function resolveExportTarget(
  symbol: ts.Symbol,
  checker: ts.TypeChecker,
): { declaration?: ts.Declaration; resolvedSymbol: ts.Symbol; isTypeOnly: boolean } {
  let resolvedSymbol = symbol;
  let isTypeOnly = false;

  // Check for type-only export
  const declarations = symbol.declarations ?? [];
  for (const decl of declarations) {
    if (ts.isExportSpecifier(decl)) {
      if (decl.isTypeOnly) isTypeOnly = true;
      const exportDecl = decl.parent?.parent;
      if (exportDecl && ts.isExportDeclaration(exportDecl) && exportDecl.isTypeOnly) {
        isTypeOnly = true;
      }
    }
  }

  // Resolve alias
  if (symbol.flags & ts.SymbolFlags.Alias) {
    const aliased = checker.getAliasedSymbol(symbol);
    if (aliased && aliased !== symbol) {
      resolvedSymbol = aliased;
    }
  }

  const targetDeclarations = resolvedSymbol.declarations ?? [];
  const declaration =
    resolvedSymbol.valueDeclaration ||
    targetDeclarations.find((d) => d.kind !== ts.SyntaxKind.ExportSpecifier) ||
    targetDeclarations[0];

  return { declaration, resolvedSymbol, isTypeOnly };
}

function serializeDeclaration(
  declaration: ts.Declaration,
  _exportSymbol: ts.Symbol,
  _targetSymbol: ts.Symbol,
  exportName: string,
  ctx: ReturnType<typeof createContext>,
  isTypeOnly: boolean,
): SpecExport | null {
  let result: SpecExport | null = null;

  if (ts.isFunctionDeclaration(declaration)) {
    result = serializeFunctionExport(declaration, ctx);
  } else if (ts.isClassDeclaration(declaration)) {
    result = serializeClass(declaration, ctx);
  } else if (ts.isInterfaceDeclaration(declaration)) {
    result = serializeInterface(declaration, ctx);
  } else if (ts.isTypeAliasDeclaration(declaration)) {
    result = serializeTypeAlias(declaration, ctx);
  } else if (ts.isEnumDeclaration(declaration)) {
    result = serializeEnum(declaration, ctx);
  } else if (ts.isVariableDeclaration(declaration)) {
    const varStatement = declaration.parent?.parent as ts.VariableStatement | undefined;
    if (varStatement && ts.isVariableStatement(varStatement)) {
      // Check if it's an arrow function - serialize as function instead of variable
      if (declaration.initializer && ts.isArrowFunction(declaration.initializer)) {
        const varName = ts.isIdentifier(declaration.name)
          ? declaration.name.text
          : declaration.name.getText();
        result = serializeFunctionExport(declaration.initializer, ctx, varName);
      } else {
        result = serializeVariable(declaration, varStatement, ctx);
      }
    }
  }

  if (result) {
    // Ensure export name matches
    if (result.name !== exportName) {
      result = { ...result, id: exportName, name: result.name };
    }
    // Add typeOnly flag
    if (isTypeOnly) {
      result = { ...result, flags: { ...(result.flags ?? {}), typeOnly: true } };
    }
  }

  return result;
}
