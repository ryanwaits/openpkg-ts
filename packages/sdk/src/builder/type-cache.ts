/**
 * Type definition caching utilities for spec extraction.
 * Provides bounded LRU caches for AST lookups to prevent memory leaks.
 */

import ts from 'typescript';
import { CacheManager } from '../utils/cache-manager';

/** Cache for findTypeDefinition results to avoid redundant AST walks */
const typeDefinitionCache = new CacheManager<string, string | undefined>({ maxSize: 1000 });

/** Cache for hasInternalTag results to avoid redundant resolveName calls */
const internalTagCache = new CacheManager<string, boolean>({ maxSize: 1000 });

/** Cache for compiled regex patterns in matchesPattern */
const regexCache = new CacheManager<string, RegExp>({ maxSize: 100 });

/** Clear all type-related caches */
export function clearTypeDefinitionCache(): void {
  typeDefinitionCache.clear();
  internalTagCache.clear();
  regexCache.clear();
}

/** Get the regex cache for pattern matching */
export function getRegexCache(): CacheManager<string, RegExp> {
  return regexCache;
}

/**
 * Find where a type is defined in the source files
 */
export function findTypeDefinition(
  typeName: string,
  program: ts.Program,
  sourceFile: ts.SourceFile,
): string | undefined {
  // Check cache first (includes both found and not-found results)
  if (typeDefinitionCache.has(typeName)) {
    return typeDefinitionCache.get(typeName);
  }

  const checker = program.getTypeChecker();

  // Search in the entry source file first
  const findInNode = (node: ts.Node): string | undefined => {
    if (
      (ts.isInterfaceDeclaration(node) ||
        ts.isTypeAliasDeclaration(node) ||
        ts.isClassDeclaration(node) ||
        ts.isEnumDeclaration(node)) &&
      node.name?.text === typeName
    ) {
      const sf = node.getSourceFile();
      return sf.fileName;
    }

    return ts.forEachChild(node, findInNode);
  };

  // Check entry file
  const entryResult = findInNode(sourceFile);
  if (entryResult) {
    typeDefinitionCache.set(typeName, entryResult);
    return entryResult;
  }

  // Check all source files in program
  for (const sf of program.getSourceFiles()) {
    if (sf.isDeclarationFile && !sf.fileName.includes('node_modules')) {
      const result = findInNode(sf);
      if (result) {
        typeDefinitionCache.set(typeName, result);
        return result;
      }
    }
  }

  // Try to find via type checker symbol lookup
  const symbol = checker.resolveName(typeName, sourceFile, ts.SymbolFlags.Type, false);
  if (symbol?.declarations?.[0]) {
    const result = symbol.declarations[0].getSourceFile().fileName;
    typeDefinitionCache.set(typeName, result);
    return result;
  }

  // Cache not-found result too
  typeDefinitionCache.set(typeName, undefined);
  return undefined;
}

/**
 * Check if a type has @internal JSDoc tag
 */
export function hasInternalTag(
  typeName: string,
  program: ts.Program,
  sourceFile: ts.SourceFile,
): boolean {
  const cached = internalTagCache.get(typeName);
  if (cached !== undefined) {
    return cached;
  }

  const checker = program.getTypeChecker();
  const symbol = checker.resolveName(typeName, sourceFile, ts.SymbolFlags.Type, false);

  if (!symbol) {
    internalTagCache.set(typeName, false);
    return false;
  }

  const jsTags = symbol.getJsDocTags();
  const isInternal = jsTags.some((tag) => tag.name === 'internal');
  internalTagCache.set(typeName, isInternal);
  return isInternal;
}
