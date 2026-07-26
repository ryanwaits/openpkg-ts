import * as fs from 'node:fs';
import * as path from 'node:path';
import ts from 'typescript';
import type { SerializerContext } from '../serializers/context';
import { buildSchema, ensureNonEmptySchema } from '../types/schema-builder';

/**
 * Reachability expansion: register named types referenced by the exported
 * surface but erased from the emitted schemas by flattening (utility-type
 * instantiations like `Omit<Base, K>`, heritage bases, inherited method
 * signatures). api-extractor bundles these into its doc model; we register
 * them in types[] so specs are self-contained.
 *
 * Scope: entry-package and workspace-resolved types always; node_modules
 * packages only when they are workspace siblings (default) or opted in via
 * `followExternal`. TS lib/builtin types never expand.
 */

export interface ExpansionOptions {
  /**
   * true → follow every node_modules package; string[] → follow the listed
   * packages (in addition to workspace siblings); false → skip the expansion
   * pass entirely; undefined → workspace siblings only.
   */
  followExternal?: boolean | string[];
  /** Workspace sibling packages from the workspace map (name → dir). */
  workspacePackages: ReadonlyMap<string, string>;
  /** Entry file — used to scope name collisions to the entry package. */
  entryFile: string;
}

/** Nearest package.json directory above a file. */
function findPackageDir(fromFile: string): string | undefined {
  let dir = path.dirname(path.resolve(fromFile));
  while (true) {
    if (fs.existsSync(path.join(dir, 'package.json'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

const NODE_MODULES_PKG = /node_modules\/(@[^/]+\/[^/]+|[^/]+)/;

function isLibFile(fileName: string): boolean {
  return fileName.includes('/typescript/lib/lib.') || fileName.includes('\\typescript\\lib\\lib.');
}

/**
 * Location predicate shared by reachability expansion and structural type
 * registration: TS lib files never expand; node_modules packages expand only
 * when workspace siblings or opted in via `followExternal`; project files
 * always expand.
 */
export function createExternalExpansionPredicate(opts: {
  followExternal?: boolean | string[];
  workspacePackages: ReadonlyMap<string, string>;
}): (symbol: ts.Symbol) => boolean {
  const packageAllowed = (pkg: string): boolean => {
    if (pkg === 'typescript') return false;
    if (opts.followExternal === true) return true;
    if (Array.isArray(opts.followExternal) && opts.followExternal.includes(pkg)) return true;
    return opts.workspacePackages.has(pkg);
  };

  return (symbol: ts.Symbol): boolean => {
    const decl = symbol.declarations?.[0];
    if (!decl) return false;
    const fileName = decl.getSourceFile().fileName;
    if (isLibFile(fileName)) return false;
    const match = fileName.match(NODE_MODULES_PKG);
    if (match) return packageAllowed(match[1]);
    // Project or workspace-resolved source file
    return true;
  };
}

export function expandReachableTypes(
  exportedSymbols: readonly ts.Symbol[],
  ctx: SerializerContext,
  opts: ExpansionOptions,
): void {
  if (opts.followExternal === false) return;

  const checker = ctx.typeChecker;
  const visited = new Set<ts.Type>();
  const MAX_DEPTH = 30;

  const entryPackageDir = findPackageDir(opts.entryFile);

  /** Package label for a declaration file, for collision-scoped ids. */
  const packageLabel = (fileName: string): string => {
    const match = fileName.match(NODE_MODULES_PKG);
    let pkg = match?.[1];
    if (!pkg) {
      for (const [name, dir] of opts.workspacePackages) {
        if (fileName.startsWith(`${path.resolve(dir)}${path.sep}`)) {
          pkg = name;
          break;
        }
      }
    }
    return (pkg ?? 'local').replace(/^@/, '').replace(/\//g, '-');
  };

  const symbolAllowed = createExternalExpansionPredicate(opts);

  const visit = (type: ts.Type, depth: number): void => {
    if (!type || depth > MAX_DEPTH || visited.has(type)) return;
    visited.add(type);

    const symbol = type.aliasSymbol ?? type.getSymbol();
    const named = !!symbol && !symbol.getName().startsWith('__');
    const allowed = !named || !symbol || symbolAllowed(symbol);

    if (named && allowed && symbol && !ctx.exportedIds.has(symbol.getName())) {
      ctx.typeRegistry.registerType(type, ctx);
      const name = symbol.getName();
      if (!symbolByName.has(name)) {
        symbolByName.set(name, symbol);
      }
    }

    // Type arguments always recurse — a disallowed container (Omit from lib,
    // React.Component) can still instantiate project types worth registering.
    for (const arg of type.aliasTypeArguments ?? []) {
      visit(arg, depth + 1);
    }
    const typeRef = type as ts.TypeReference;
    if (typeRef.target) {
      for (const arg of checker.getTypeArguments(typeRef) ?? []) {
        visit(arg, depth + 1);
      }
    }

    if (type.isUnion() || type.isIntersection()) {
      for (const t of type.types) {
        visit(t, depth + 1);
      }
    }

    // Members only for in-scope types: walking into DOM/react internals would
    // pull their whole graphs.
    if (!allowed || !(type.flags & ts.TypeFlags.Object || type.isClassOrInterface())) {
      return;
    }

    if (type.isClassOrInterface()) {
      for (const base of checker.getBaseTypes(type) ?? []) {
        visit(base, depth + 1);
      }
    }

    for (const prop of type.getProperties().slice(0, ctx.maxProperties)) {
      if (prop.getName().startsWith('__@')) continue;
      visit(checker.getTypeOfSymbol(prop), depth + 1);
    }

    for (const sig of [...type.getCallSignatures(), ...type.getConstructSignatures()]) {
      for (const param of sig.getParameters()) {
        visit(checker.getTypeOfSymbol(param), depth + 1);
      }
      visit(sig.getReturnType(), depth + 1);
    }

    for (const info of checker.getIndexInfosOfType(type)) {
      visit(info.type, depth + 1);
    }
  };

  // ---- Syntactic reference walk -------------------------------------------
  // The checker erases some alias identities entirely (`type X = any`,
  // indexed-access unions like `(typeof levels)[number]`), so a type-level
  // walk can never recover those names. Walk the declaration ASTs instead:
  // every type-reference identifier resolves to a symbol we can register by
  // name, then its own declarations are walked transitively.

  const TYPE_SYMBOL_FLAGS =
    ts.SymbolFlags.Interface |
    ts.SymbolFlags.TypeAlias |
    ts.SymbolFlags.Class |
    ts.SymbolFlags.RegularEnum |
    ts.SymbolFlags.ConstEnum;

  const visitedSymbols = new Set<ts.Symbol>();

  const symbolKind = (symbol: ts.Symbol): 'interface' | 'class' | 'enum' | 'type' => {
    if (symbol.flags & ts.SymbolFlags.Interface) return 'interface';
    if (symbol.flags & ts.SymbolFlags.Class) return 'class';
    if (symbol.flags & (ts.SymbolFlags.RegularEnum | ts.SymbolFlags.ConstEnum)) return 'enum';
    return 'type';
  };

  const resolveAlias = (symbol: ts.Symbol): ts.Symbol | undefined => {
    if (symbol.flags & ts.SymbolFlags.Alias) {
      try {
        return checker.getAliasedSymbol(symbol);
      } catch {
        return undefined;
      }
    }
    return symbol;
  };

  const symbolByName = new Map<string, ts.Symbol>();

  const registerTypeSymbol = (symbol: ts.Symbol): void => {
    const name = symbol.getName();
    if (name.startsWith('__')) return;
    if (!(symbol.flags & TYPE_SYMBOL_FLAGS)) return;
    if (!symbolAllowed(symbol)) return;

    // Exported names belong to the main serialization pass — registering them
    // in types[] would duplicate exports[] entries with a different shape.
    if (ctx.exportedIds.has(name)) {
      walkDeclarations(symbol);
      return;
    }

    if (ctx.typeRegistry.has(name)) {
      const prior = symbolByName.get(name);
      if (prior !== symbol) {
        const declFile = symbol.declarations?.[0]?.getSourceFile().fileName ?? '';
        const foreign = !!entryPackageDir && !declFile.startsWith(`${entryPackageDir}${path.sep}`);
        // A tracked different symbol always collides; an untracked name only
        // when the new symbol lives outside the entry package.
        if (prior !== undefined || foreign) {
          // Same name, different type: register under a package-scoped id
          // (deterministic, no api-extractor-style `_2` suffixes).
          const scopedId = `${packageLabel(declFile)}.${name}`;
          if (!ctx.typeRegistry.has(scopedId)) {
            const declared = checker.getDeclaredTypeOfSymbol(symbol);
            const schema = ensureNonEmptySchema(
              buildSchema(declared, checker, ctx),
              declared,
              checker,
            );
            // Same type reached twice through registration paths that skip
            // symbol tracking: structurally identical, or collapsed to a bare
            // $ref back at the clean-name entry.
            const selfRef = JSON.stringify(schema) === JSON.stringify({ $ref: `#/types/${name}` });
            if (
              !selfRef &&
              JSON.stringify(ctx.typeRegistry.get(name)?.schema) !== JSON.stringify(schema)
            ) {
              ctx.typeRegistry.add({
                id: scopedId,
                name,
                kind: symbolKind(symbol),
                schema,
              });
              visit(declared, 0);
            }
          }
        }
      }
      walkDeclarations(symbol);
      return;
    }

    const declared = checker.getDeclaredTypeOfSymbol(symbol);
    ctx.typeRegistry.registerType(declared, ctx);
    if (!ctx.typeRegistry.has(name)) {
      // Alias identity erased by the checker — register from the symbol.
      ctx.typeRegistry.add({
        id: name,
        name,
        kind: symbolKind(symbol),
        schema: ensureNonEmptySchema(buildSchema(declared, checker, ctx), declared, checker),
      });
    }
    symbolByName.set(name, symbol);
    visit(declared, 0);
    walkDeclarations(symbol);
  };

  const handleRef = (nameNode: ts.Node): void => {
    const symbol = checker.getSymbolAtLocation(nameNode);
    const target = symbol && resolveAlias(symbol);
    if (target) registerTypeSymbol(target);
  };

  // Referencing `Namespace.Type` makes the whole namespace addressable API
  // surface — register its exported types like api-extractor bundles them.
  const handleNamespaceRef = (nameNode: ts.Node): void => {
    const symbol = checker.getSymbolAtLocation(nameNode);
    const target = symbol && resolveAlias(symbol);
    if (!target || visitedSymbols.has(target)) return;
    if (!(target.flags & (ts.SymbolFlags.ValueModule | ts.SymbolFlags.NamespaceModule))) return;
    if (!symbolAllowed(target)) return;
    visitedSymbols.add(target);
    for (const exp of checker.getExportsOfModule(target)) {
      const expTarget = resolveAlias(exp);
      if (!expTarget) continue;
      if (expTarget.flags & TYPE_SYMBOL_FLAGS) {
        registerTypeSymbol(expTarget);
      }
    }
  };

  const walkNode = (node: ts.Node): void => {
    if (ts.isTypeReferenceNode(node)) {
      handleRef(node.typeName);
      if (ts.isQualifiedName(node.typeName)) {
        handleNamespaceRef(node.typeName.left);
      }
    } else if (ts.isExpressionWithTypeArguments(node)) {
      handleRef(node.expression);
    } else if (ts.isTypeQueryNode(node)) {
      handleRef(node.exprName);
      if (ts.isQualifiedName(node.exprName)) {
        // `typeof Enum.Member`: the merged const+type symbol is the left side
        handleRef(node.exprName.left);
        handleNamespaceRef(node.exprName.left);
      }
    } else if (ts.isImportTypeNode(node) && node.qualifier) {
      handleRef(node.qualifier);
      if (ts.isQualifiedName(node.qualifier)) {
        handleNamespaceRef(node.qualifier.left);
      }
    }
    node.forEachChild(walkNode);
  };

  const walkDeclarations = (symbol: ts.Symbol): void => {
    if (visitedSymbols.has(symbol)) return;
    visitedSymbols.add(symbol);
    for (const decl of symbol.declarations ?? []) {
      walkNode(decl);
    }
  };

  // ---- Seeds ---------------------------------------------------------------

  for (const exportSymbol of exportedSymbols) {
    let target = exportSymbol;
    if (exportSymbol.flags & ts.SymbolFlags.Alias) {
      try {
        target = checker.getAliasedSymbol(exportSymbol);
      } catch {
        continue;
      }
    }

    // Value side (classes, functions, consts)
    const decl = target.valueDeclaration ?? target.declarations?.[0];
    if (decl) {
      visit(checker.getTypeOfSymbolAtLocation(target, decl), 0);
    }
    // Type side (interfaces, aliases, enums; class instance type)
    if (target.flags & TYPE_SYMBOL_FLAGS) {
      visit(checker.getDeclaredTypeOfSymbol(target), 0);
    }

    walkDeclarations(target);
  }
}
