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
  program?: ts.Program,
): { declaration?: ts.Declaration; targetSymbol: ts.Symbol; isTypeOnly: boolean } {
  const isTypeOnly = isTypeOnlyExport(symbol);
  const targetSymbol = resolveAliasSymbol(symbol, checker, undefined, program);

  const declarations = targetSymbol.declarations ?? [];
  // Specifiers are aliases, not the type-carrying declaration. Falling back
  // to them made `export { x } from "missing-pkg"` look local (`internal`)
  // instead of an external stub / no-declaration skip.
  const declaration =
    targetSymbol.valueDeclaration ||
    declarations.find(
      (decl) =>
        decl.kind !== ts.SyntaxKind.ExportSpecifier &&
        decl.kind !== ts.SyntaxKind.ImportSpecifier &&
        decl.kind !== ts.SyntaxKind.ExportDeclaration &&
        decl.kind !== ts.SyntaxKind.ImportClause &&
        decl.kind !== ts.SyntaxKind.NamespaceExport,
    );

  return { declaration, targetSymbol, isTypeOnly };
}

/**
 * `getAliasedSymbol` does not follow named re-exports of bindings that arrived
 * via `export *` (immer: `export { original } from "./internal"` where internal
 * is star-exports). Walk the module's export table instead.
 */
export function resolveAliasSymbol(
  symbol: ts.Symbol,
  checker: ts.TypeChecker,
  seen: Set<ts.Symbol> = new Set(),
  program?: ts.Program,
): ts.Symbol {
  if (seen.has(symbol)) return symbol;
  seen.add(symbol);

  if (symbol.flags & ts.SymbolFlags.Alias) {
    try {
      const aliased = checker.getAliasedSymbol(symbol);
      if (aliased && aliased !== symbol && hasConcreteDeclaration(aliased)) {
        return resolveAliasSymbol(aliased, checker, seen, program);
      }
    } catch {
      /* fall through to specifier walk */
    }
  }

  for (const decl of symbol.declarations ?? []) {
    const fromModule = resolveFromModuleSpecifier(decl, symbol, checker, program);
    if (fromModule && fromModule !== symbol) {
      return resolveAliasSymbol(fromModule, checker, seen, program);
    }
  }

  return symbol;
}

function hasConcreteDeclaration(symbol: ts.Symbol): boolean {
  if (symbol.valueDeclaration) return true;
  return (symbol.declarations ?? []).some(
    (d) =>
      d.kind !== ts.SyntaxKind.ExportSpecifier &&
      d.kind !== ts.SyntaxKind.ImportSpecifier &&
      d.kind !== ts.SyntaxKind.ExportDeclaration &&
      d.kind !== ts.SyntaxKind.NamespaceExport,
  );
}

function resolveFromModuleSpecifier(
  decl: ts.Declaration,
  symbol: ts.Symbol,
  checker: ts.TypeChecker,
  program?: ts.Program,
): ts.Symbol | undefined {
  let moduleSpecifier: ts.Expression | undefined;
  let importedName: string | undefined;

  if (ts.isExportSpecifier(decl)) {
    const exportDecl = decl.parent?.parent;
    if (exportDecl && ts.isExportDeclaration(exportDecl)) {
      // `import { X } from './x'; export { X }`: the specifier is on the
      // import, reached through the local binding.
      if (!exportDecl.moduleSpecifier) {
        const local = checker.getExportSpecifierLocalTargetSymbol(decl);
        return local && local !== symbol ? local : undefined;
      }
      moduleSpecifier = exportDecl.moduleSpecifier;
      importedName = (decl.propertyName ?? decl.name).text;
    }
  } else if (ts.isImportSpecifier(decl)) {
    const importDecl = decl.parent?.parent?.parent;
    if (importDecl && ts.isImportDeclaration(importDecl)) {
      moduleSpecifier = importDecl.moduleSpecifier;
      importedName = (decl.propertyName ?? decl.name).text;
    }
  } else if (ts.isImportClause(decl) && decl.name) {
    const importDecl = decl.parent;
    if (ts.isImportDeclaration(importDecl)) {
      moduleSpecifier = importDecl.moduleSpecifier;
      importedName = 'default';
    }
  }

  if (!moduleSpecifier || importedName === undefined || !ts.isStringLiteral(moduleSpecifier)) {
    return undefined;
  }

  let modSym = checker.getSymbolAtLocation(moduleSpecifier);
  if (!modSym && program) {
    const containing = decl.getSourceFile().fileName;
    const resolved = ts.resolveModuleName(
      moduleSpecifier.text,
      containing,
      program.getCompilerOptions(),
      ts.sys,
    );
    const file = resolved.resolvedModule?.resolvedFileName;
    const sf = file ? program.getSourceFile(file) : undefined;
    if (sf) modSym = checker.getSymbolAtLocation(sf);
  }
  if (!modSym) return undefined;
  if (modSym.flags & ts.SymbolFlags.Alias) {
    try {
      modSym = checker.getAliasedSymbol(modSym);
    } catch {
      return undefined;
    }
  }
  if (!modSym) return undefined;

  const exported = getModuleExportsFollowingStars(modSym, checker, program);
  const match = exported.find((e) => e.getName() === importedName);
  return match && match !== symbol ? match : undefined;
}

/** `export * from './x'` is sometimes invisible to getExportsOfModule; walk it. */
function getModuleExportsFollowingStars(
  modSym: ts.Symbol,
  checker: ts.TypeChecker,
  program: ts.Program | undefined,
  seen: Set<ts.Symbol> = new Set(),
): ts.Symbol[] {
  if (seen.has(modSym)) return [];
  seen.add(modSym);
  const byName = new Map<string, ts.Symbol>();
  for (const s of checker.getExportsOfModule(modSym)) {
    byName.set(s.getName(), s);
  }

  for (const decl of modSym.declarations ?? []) {
    const sf = ts.isSourceFile(decl) ? decl : decl.getSourceFile();
    for (const stmt of sf.statements) {
      if (
        !ts.isExportDeclaration(stmt) ||
        stmt.exportClause ||
        !stmt.moduleSpecifier ||
        !ts.isStringLiteral(stmt.moduleSpecifier)
      ) {
        continue;
      }
      const nested = moduleSymbolFromPath(stmt.moduleSpecifier.text, sf.fileName, checker, program);
      if (!nested) continue;
      for (const s of getModuleExportsFollowingStars(nested, checker, program, seen)) {
        if (!byName.has(s.getName())) byName.set(s.getName(), s);
      }
    }
  }
  return [...byName.values()];
}

function moduleSymbolFromPath(
  spec: string,
  containingFile: string,
  checker: ts.TypeChecker,
  program: ts.Program | undefined,
): ts.Symbol | undefined {
  if (!program) return undefined;
  const resolved = ts.resolveModuleName(spec, containingFile, program.getCompilerOptions(), ts.sys);
  const file = resolved.resolvedModule?.resolvedFileName;
  const sf = file ? program.getSourceFile(file) : undefined;
  return sf ? checker.getSymbolAtLocation(sf) : undefined;
}
