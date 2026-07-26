import type { SpecExport, SpecType } from '@openpkg-ts/spec';
import ts from 'typescript';
import { getExportKind } from '../ast/utils';
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
    return {
      export: null,
      types: [],
      errors: [`Entry file not found: ${entryFile}. Specify with: drift get src/index.ts <name>`],
    };
  }

  const checker = program.getTypeChecker();
  const moduleSymbol = checker.getSymbolAtLocation(sourceFile);

  if (!moduleSymbol) {
    return {
      export: null,
      types: [],
      errors: [`No exports found in ${entryFile}. Is this the right entry point?`],
    };
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
    // Check if original symbol is a namespace export before resolving alias
    const originalDecls = targetSymbol.declarations ?? [];
    const isNamespaceExportDecl = originalDecls.some(
      (d) => ts.isNamespaceExport(d) || ts.isNamespaceImport(d),
    );

    if (isNamespaceExportDecl) {
      const spec = serializeNamespaceForGet(targetSymbol, exportName, ctx);
      const types = ctx.typeRegistry.getAll().map((t) => normalizeType(t));
      return {
        export: normalizeExport(spec) as SpecExport,
        types,
        errors,
      };
    }

    const { declaration, resolvedSymbol, isTypeOnly } = resolveExportTarget(targetSymbol, checker);

    if (!declaration) {
      // Check if this is an external re-export
      const externalPackage = detectExternalPackage(targetSymbol, checker);
      if (externalPackage) {
        const stub: SpecExport = {
          id: exportName,
          name: exportName,
          kind: 'external',
          source: { package: externalPackage },
        };
        return { export: stub, types: [], errors };
      }
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
      // Fallback: check if external re-export that couldn't be serialized
      const externalPackage = detectExternalPackage(targetSymbol, checker);
      if (externalPackage) {
        const stub: SpecExport = {
          id: exportName,
          name: exportName,
          kind: 'external',
          source: { package: externalPackage },
        };
        return { export: stub, types: [], errors };
      }
      return { export: null, types: [], errors: [`Could not serialize '${exportName}'`] };
    }

    // Normalize the export
    spec = normalizeExport(spec) as SpecExport;

    // Get types referenced
    const types = ctx.typeRegistry.getAll().map((t) => normalizeType(t));

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
      // Check if it's an arrow/function expression - serialize as function instead of variable
      if (
        declaration.initializer &&
        (ts.isArrowFunction(declaration.initializer) ||
          ts.isFunctionExpression(declaration.initializer))
      ) {
        const varName = ts.isIdentifier(declaration.name)
          ? declaration.name.text
          : declaration.name.getText();
        result = serializeFunctionExport(declaration.initializer, ctx, varName);
      } else {
        // Check if the variable's type has call signatures (function type annotation)
        const checker = ctx.program.getTypeChecker();
        const varType = checker.getTypeAtLocation(declaration);
        if (varType.getCallSignatures().length > 0) {
          result = serializeVariable(declaration, varStatement, ctx);
          if (result) result = { ...result, kind: 'function' };
        } else {
          result = serializeVariable(declaration, varStatement, ctx);
        }
      }
    }
  } else if (
    ts.isNamespaceExport(declaration) ||
    ts.isModuleDeclaration(declaration) ||
    ts.isNamespaceImport(declaration) ||
    ts.isSourceFile(declaration)
  ) {
    result = serializeNamespaceForGet(_exportSymbol, exportName, ctx);
  }

  if (result) {
    // Ensure export name matches
    if (result.name !== exportName) {
      result = { ...result, id: exportName, name: exportName };
    }
    // Add typeOnly flag
    if (isTypeOnly) {
      result = { ...result, flags: { ...(result.flags ?? {}), typeOnly: true } };
    }
  }

  return result;
}

function serializeNamespaceForGet(
  symbol: ts.Symbol,
  exportName: string,
  ctx: ReturnType<typeof createContext>,
): SpecExport {
  const checker = ctx.program.getTypeChecker();

  // Resolve alias to get the actual module symbol
  let targetSymbol = symbol;
  if (symbol.flags & ts.SymbolFlags.Alias) {
    const aliased = checker.getAliasedSymbol(symbol);
    if (aliased && aliased !== symbol) {
      targetSymbol = aliased;
    }
  }

  // Get exports from the namespace module
  const members: Array<{ name: string; kind: string }> = [];
  try {
    const nsExports = checker.getExportsOfModule(targetSymbol);
    for (const memberSymbol of nsExports) {
      const memberName = memberSymbol.getName();
      const memberDecls = memberSymbol.declarations ?? [];
      const memberDecl = memberSymbol.valueDeclaration || memberDecls[0];
      if (memberDecl) {
        const type = checker.getTypeAtLocation(memberDecl);
        const kind = getExportKind(memberDecl, type);
        members.push({ name: memberName, kind });
      }
    }
  } catch {
    // Namespace member enumeration may fail for some external modules
  }

  return {
    id: exportName,
    name: exportName,
    kind: 'namespace',
    tags: [],
    ...(members.length > 0 ? { members } : {}),
  };
}

function detectExternalPackage(symbol: ts.Symbol, checker: ts.TypeChecker): string | undefined {
  // Check all declarations (original + aliased) for node_modules paths
  let targetSymbol = symbol;
  if (symbol.flags & ts.SymbolFlags.Alias) {
    const aliased = checker.getAliasedSymbol(symbol);
    if (aliased && aliased !== symbol) {
      targetSymbol = aliased;
    }
  }

  const allDecls = [...(targetSymbol.declarations ?? []), ...(symbol.declarations ?? [])];
  for (const decl of allDecls) {
    const sf = decl.getSourceFile();
    if (sf?.fileName.includes('node_modules')) {
      const match = sf.fileName.match(/node_modules\/(@[^/]+\/[^/]+|[^/]+)/);
      if (match) return match[1];
    }
    // Check export specifier with module specifier
    if (ts.isExportSpecifier(decl)) {
      const exportDecl = decl.parent?.parent;
      if (exportDecl && ts.isExportDeclaration(exportDecl) && exportDecl.moduleSpecifier) {
        const moduleText = (exportDecl.moduleSpecifier as ts.StringLiteral).text;
        if (!moduleText.startsWith('.') && !moduleText.startsWith('/')) {
          return moduleText;
        }
      }
    }
  }
  return undefined;
}
