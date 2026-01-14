import ts from 'typescript';

/**
 * Check if an export symbol is a type-only export (export type { X }).
 */
export function isTypeOnlyExport(symbol: ts.Symbol): boolean {
  const declarations = symbol.declarations ?? [];
  for (const decl of declarations) {
    // Check if this is an ExportSpecifier
    if (ts.isExportSpecifier(decl)) {
      // Check if the specifier itself is type-only
      if (decl.isTypeOnly) return true;
      // Check if the parent ExportDeclaration is type-only
      const exportDecl = decl.parent?.parent;
      if (exportDecl && ts.isExportDeclaration(exportDecl) && exportDecl.isTypeOnly) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Follows export aliases back to the declaration that carries the type info.
 */
export function resolveExportTarget(
  symbol: ts.Symbol,
  checker: ts.TypeChecker,
): { declaration?: ts.Declaration; targetSymbol: ts.Symbol; isTypeOnly: boolean } {
  let targetSymbol = symbol;
  const isTypeOnly = isTypeOnlyExport(symbol);

  if (symbol.flags & ts.SymbolFlags.Alias) {
    const aliasTarget = checker.getAliasedSymbol(symbol);
    if (aliasTarget && aliasTarget !== symbol) {
      targetSymbol = aliasTarget;
    }
  }

  const declarations = targetSymbol.declarations ?? [];
  const declaration =
    targetSymbol.valueDeclaration ||
    declarations.find((decl) => decl.kind !== ts.SyntaxKind.ExportSpecifier) ||
    declarations[0];

  return { declaration, targetSymbol, isTypeOnly };
}
