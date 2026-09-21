/**
 * Collision-safe type identity.
 *
 * The type registry and every `$ref` emitter must agree on a single id per
 * type, even when two distinct types share a name (e.g. a `Logger` interface in
 * two different packages of one build). Keying by bare name lets one shadow the
 * other and drops its members. This module assigns a stable id per declaration
 * symbol: the first symbol to claim a bare name keeps it (so specs without
 * collisions are byte-identical to before), and any later distinct symbol with
 * the same name gets a scoped id: `<package>.<Name>` when it lives in another
 * package than the bare name's owner, else `<Namespace>.<Name>` for a
 * declaration inside a `namespace`, else `<file>.<Name>` from the declaring
 * file's basename (`devtools.Options`). Exported types claim their bare name
 * before anything else is serialized, so a private namesake never takes it.
 */
import * as path from 'node:path';
import ts from 'typescript';
import type { SerializerContext } from '../serializers/context';

const NODE_MODULES_PKG = /node_modules\/(@[^/]+\/[^/]+|[^/]+)/g;

/**
 * Hard cap on types[] entries. `followExternal` on packages with large
 * generic method graphs (zod, typescript) can otherwise allocate without
 * bound: `Set<ts.Type>` identity misses instantiations, so depth limits
 * do not cut the walk.
 */
export const MAX_REGISTERED_TYPES = 10_000;

/**
 * True when the symbol is declared in a non-workspace node_modules package.
 * Workspace siblings live under node_modules via symlink but stay in-graph.
 * Foreign packages (zod, typescript, …) must not have their method graphs
 * walked: generic instantiations slip past `Set<ts.Type>` cycle cuts.
 */
export function isForeignPackage(
  symbol: ts.Symbol | undefined,
  workspacePackages: ReadonlyMap<string, string>,
): boolean {
  const decl = symbol?.declarations?.[0];
  if (!decl) return false;
  const pkg = packageNameFromPath(decl.getSourceFile().fileName);
  if (!pkg) return false;
  return !workspacePackages.has(pkg);
}

/**
 * TypeScript's bundled platform libs (lib.dom, lib.es*). They sit inside the
 * `typescript` package dir but are globals, not that package's API.
 */
export function isLibFile(fileName: string): boolean {
  return fileName.includes('/typescript/lib/lib.') || fileName.includes('\\typescript\\lib\\lib.');
}

/**
 * A platform global, judged over ALL declarations. Globals merge: `AbortSignal`
 * is declared by lib.dom and again by bun-types / @types/node, and which one
 * comes first depends on the TypeScript version. Reading only the first makes
 * the spec differ by compiler.
 */
export function isLibSymbol(symbol: ts.Symbol | undefined): boolean {
  return symbol?.declarations?.some((d) => isLibFile(d.getSourceFile().fileName)) ?? false;
}

/**
 * Package name for a file under node_modules, else undefined. Takes the LAST
 * node_modules segment: store layouts (`.pnpm/zod@3/node_modules/zod`,
 * `.bun/…`) and nested deps put the real package there, and the first
 * segment is the store dir.
 */
export function packageNameFromPath(fileName: string): string | undefined {
  return [...fileName.matchAll(NODE_MODULES_PKG)].at(-1)?.[1];
}

/**
 * A stable, filesystem-derived label for the package a declaration lives in.
 * node_modules packages resolve to their package name; workspace files to the
 * workspace package name; everything else to "local". Used to disambiguate
 * same-named types across packages.
 */
export function packageLabel(
  fileName: string,
  workspacePackages: ReadonlyMap<string, string>,
): string {
  let pkg = packageNameFromPath(fileName);
  if (!pkg) {
    for (const [name, dir] of workspacePackages) {
      if (fileName.startsWith(`${path.resolve(dir)}${path.sep}`)) {
        pkg = name;
        break;
      }
    }
  }
  return (pkg ?? 'local').replace(/^@/, '').replace(/\//g, '-');
}

/**
 * A stable identity for the DECLARATION a type comes from. Import aliases and
 * re-exports resolve to the same underlying declaration, so they collapse to
 * one key (no spurious splits); two genuinely different types named the same
 * live at different declarations, so they get different keys. Returns undefined
 * when there is no declaration to key on (fall back to symbol identity).
 */
function declKey(symbol: ts.Symbol, checker: ts.TypeChecker): string | undefined {
  let resolved = symbol;
  if (symbol.flags & ts.SymbolFlags.Alias) {
    try {
      resolved = checker.getAliasedSymbol(symbol);
    } catch {
      /* keep original */
    }
  }
  const decl = resolved.declarations?.[0];
  if (!decl) return undefined;
  return `${decl.getSourceFile().fileName}#${decl.getStart()}`;
}

/**
 * Readable label for the file a declaration lives in: basename without its
 * TypeScript extension; an `index` file goes by its directory.
 */
function fileLabel(fileName: string): string {
  const base = path.basename(fileName).replace(/(\.d)?\.[cm]?[tj]sx?$/, '');
  return base === 'index' ? path.basename(path.dirname(fileName)) || base : base;
}

/** Dotted names of the `namespace` blocks enclosing a declaration, if any. */
function namespaceLabel(decl: ts.Declaration | undefined): string | undefined {
  const names: string[] = [];
  for (let node: ts.Node | undefined = decl?.parent; node; node = node.parent) {
    if (ts.isModuleDeclaration(node) && ts.isIdentifier(node.name)) names.unshift(node.name.text);
  }
  return names.length > 0 ? names.join('.') : undefined;
}

/**
 * Assign (or return the cached) collision-free id for a type declaration.
 * First declaration to claim a bare name keeps it; later distinct declarations
 * get `<package>.<Name>` (another package than the bare name's owner), then
 * `<Namespace>.<Name>` (declared in a `namespace`), then `<file>.<Name>`, then `<Name>_2`, `<Name>_3` as a last resort.
 */
export function resolveTypeId(symbol: ts.Symbol, ctx: SerializerContext): string {
  const cached = ctx.typeIds.get(symbol);
  if (cached) return cached;

  const key = declKey(symbol, ctx.typeChecker);
  // Another symbol for the SAME declaration already has an id — reuse it.
  if (key) {
    const existing = ctx.declIds.get(key);
    if (existing) {
      ctx.typeIds.set(symbol, existing);
      return existing;
    }
  }

  const claim = (id: string): string => {
    ctx.typeIds.set(symbol, id);
    if (key) ctx.declIds.set(key, id);
    ctx.idOwner.set(id, key ?? id);
    return id;
  };

  const name = symbol.getName();
  const owner = ctx.idOwner.get(name);
  if (!owner || owner === key) return claim(name);

  // Collision: a different declaration already owns this name. Scope by
  // package when that tells the two apart, else by declaring file.
  const decl = symbol.declarations?.[0];
  const file = decl?.getSourceFile().fileName ?? '';
  const pkg = packageLabel(file, ctx.workspacePackages);
  const ownerFile = owner.includes('#') ? owner.slice(0, owner.lastIndexOf('#')) : '';
  const scopes = pkg === packageLabel(ownerFile, ctx.workspacePackages) ? [] : [pkg];
  const namespace = namespaceLabel(decl);
  if (namespace) scopes.push(namespace);
  if (file) scopes.push(fileLabel(file));
  for (const scope of scopes) {
    const scoped = `${scope}.${name}`;
    const scopedOwner = ctx.idOwner.get(scoped);
    if (!scopedOwner || scopedOwner === key) return claim(scoped);
  }

  // Same file AND same name (rare): fall back to a numeric suffix.
  let n = 2;
  while (ctx.idOwner.has(`${name}_${n}`)) n++;
  return claim(`${name}_${n}`);
}

const EXPORTABLE_TYPE_FLAGS =
  ts.SymbolFlags.Interface |
  ts.SymbolFlags.TypeAlias |
  ts.SymbolFlags.Class |
  ts.SymbolFlags.RegularEnum |
  ts.SymbolFlags.ConstEnum;

/**
 * Give every exported type its bare name before anything is serialized, so a
 * file-private namesake reached first cannot take it. Export names are unique,
 * which makes the outcome independent of export order and `only` filters.
 */
export function claimExportedTypeIds(
  exportedSymbols: readonly ts.Symbol[],
  ctx: SerializerContext,
): void {
  const renamed: ts.Symbol[] = [];
  for (const exported of exportedSymbols) {
    let target = exported;
    if (exported.flags & ts.SymbolFlags.Alias) {
      try {
        target = ctx.typeChecker.getAliasedSymbol(exported);
      } catch {
        continue;
      }
    }
    if (!(target.flags & EXPORTABLE_TYPE_FLAGS)) continue;
    // `export { output as TypeOf }` must not take `output` from the type that
    // is exported as `output`.
    if (target.getName() === exported.getName()) resolveTypeId(target, ctx);
    else renamed.push(target);
  }
  for (const target of renamed) resolveTypeId(target, ctx);
}

/**
 * The id a `$ref` should point at for a given type. Matches how the registry
 * keys the type, so refs and registered entries always agree. Returns the bare
 * name when there is no context to disambiguate against.
 */
export function typeRefId(type: ts.Type, ctx: SerializerContext | undefined): string {
  const symbol = type.aliasSymbol ?? type.getSymbol();
  if (!symbol) return '';
  if (!ctx) return symbol.getName();
  return resolveTypeId(symbol, ctx);
}
