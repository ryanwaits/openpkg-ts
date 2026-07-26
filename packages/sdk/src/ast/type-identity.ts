/**
 * Collision-safe type identity.
 *
 * The type registry and every `$ref` emitter must agree on a single id per
 * type, even when two distinct types share a name (e.g. a `Logger` interface in
 * two different packages of one build). Keying by bare name lets one shadow the
 * other and drops its members. This module assigns a stable id per declaration
 * symbol: the first symbol to claim a bare name keeps it (so specs without
 * collisions are byte-identical to before), and any later distinct symbol with
 * the same name gets a package-scoped id.
 */
import * as path from 'node:path';
import ts from 'typescript';
import type { SerializerContext } from '../serializers/context';

const NODE_MODULES_PKG = /node_modules\/(@[^/]+\/[^/]+|[^/]+)/;

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
  const match = fileName.match(NODE_MODULES_PKG);
  let pkg = match?.[1];
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
 * Assign (or return the cached) collision-free id for a type declaration.
 * First declaration to claim a bare name keeps it; later distinct declarations
 * get `<package>.<name>`, then `<name>_2`, `<name>_3` as a last resort.
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

  // Collision: a different declaration already owns this name. Scope by package.
  const file = symbol.declarations?.[0]?.getSourceFile().fileName ?? '';
  const scoped = `${packageLabel(file, ctx.workspacePackages)}.${name}`;
  const scopedOwner = ctx.idOwner.get(scoped);
  if (!scopedOwner || scopedOwner === key) return claim(scoped);

  // Same package AND same name (rare): fall back to a numeric suffix.
  let n = 2;
  while (ctx.idOwner.has(`${name}_${n}`)) n++;
  return claim(`${name}_${n}`);
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
