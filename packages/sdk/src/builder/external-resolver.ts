/**
 * External package re-export resolution utilities
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { SpecExport, SpecExportKind } from '@openpkg-ts/spec';
import picomatch from 'picomatch';
import ts from 'typescript';
import { getExportKind } from '../ast/utils';
import type { SerializerContext } from '../serializers/context';
import { buildSignatures } from '../serializers/shared';
import { registerReferencedTypes } from '../types/parameters';
import { buildSchema } from '../types/schema-builder';

/**
 * Check if a package name matches the include/exclude patterns
 */
export function matchesExternalPattern(
  packageName: string,
  include?: string[],
  exclude?: string[],
): boolean {
  if (!include?.length) return false;

  // Use bash: true to allow * to match across / in scoped packages
  const matchOptions = { bash: true };

  const isIncluded = include.some((p) => picomatch.isMatch(packageName, p, matchOptions));
  if (!isIncluded) return false;

  if (exclude?.length) {
    const isExcluded = exclude.some((p) => picomatch.isMatch(packageName, p, matchOptions));
    if (isExcluded) return false;
  }

  return true;
}

/**
 * Result of resolving an external module
 */
export interface ResolvedExternalModule {
  resolvedPath: string;
  packageName: string;
  packageVersion?: string;
}

/**
 * Attempt to resolve an external module specifier to its declaration file
 */
export function resolveExternalModule(
  moduleSpecifier: string,
  containingFile: string,
  compilerOptions: ts.CompilerOptions,
): ResolvedExternalModule | null {
  const resolved = ts.resolveModuleName(moduleSpecifier, containingFile, compilerOptions, ts.sys);

  if (!resolved.resolvedModule) {
    return null;
  }

  const resolvedPath = resolved.resolvedModule.resolvedFileName;

  // Try to find package.json for version info
  const packageJson = findPackageJson(resolvedPath, moduleSpecifier);

  return {
    resolvedPath,
    packageName: moduleSpecifier,
    packageVersion: packageJson?.version,
  };
}

/**
 * Find package.json for a resolved module path
 */
function findPackageJson(
  resolvedPath: string,
  packageName: string,
): { version?: string } | undefined {
  // Handle scoped packages (@org/pkg)
  const isScoped = packageName.startsWith('@');
  const packageParts = isScoped ? packageName.split('/').slice(0, 2) : [packageName.split('/')[0]];
  const packageDir = packageParts.join('/');

  // Walk up from resolved path to find node_modules/[package]/package.json
  let dir = path.dirname(resolvedPath);
  const maxDepth = 10;

  for (let i = 0; i < maxDepth; i++) {
    // Check if we're in the package directory
    if (dir.endsWith(`node_modules/${packageDir}`)) {
      const pkgPath = path.join(dir, 'package.json');
      if (fs.existsSync(pkgPath)) {
        try {
          return JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        } catch {
          return undefined;
        }
      }
    }

    const parent = path.dirname(dir);
    if (parent === dir) break; // Reached root
    dir = parent;
  }

  return undefined;
}

/**
 * Determine the export kind from a TypeScript symbol
 */

/**
 * Extract a specific export from a resolved external module
 */
export function extractExternalExport(
  exportName: string,
  resolvedModule: ResolvedExternalModule,
  program: ts.Program,
  ctx: SerializerContext,
  visited: Set<string>,
): SpecExport | null {
  const key = `${resolvedModule.resolvedPath}:${exportName}`;

  // Cycle detection
  if (visited.has(key)) {
    // Return a stub for cycles
    return {
      id: exportName,
      name: exportName,
      kind: 'external',
      source: {
        package: resolvedModule.packageName,
        version: resolvedModule.packageVersion,
      },
    };
  }
  visited.add(key);

  const checker = program.getTypeChecker();
  const sourceFile = program.getSourceFile(resolvedModule.resolvedPath);

  if (!sourceFile) {
    return null;
  }

  // Get the module symbol and its exports
  const moduleSymbol = checker.getSymbolAtLocation(sourceFile);
  if (!moduleSymbol) {
    return null;
  }

  const exports = checker.getExportsOfModule(moduleSymbol);
  const targetExport = exports.find((e) => e.getName() === exportName);

  if (!targetExport) {
    return null;
  }

  // Resolve alias if needed
  let resolvedSymbol = targetExport;
  if (targetExport.flags & ts.SymbolFlags.Alias) {
    const aliased = checker.getAliasedSymbol(targetExport);
    if (aliased && aliased !== targetExport) {
      resolvedSymbol = aliased;
    }
  }

  const decl = (resolvedSymbol.declarations ?? [])[0];
  const kind = decl
    ? getExportKind(decl, checker.getTypeAtLocation(decl))
    : ('variable' as SpecExportKind);

  // Get JSDoc info
  const docComment = resolvedSymbol.getDocumentationComment(checker);
  const description = docComment.length > 0 ? docComment.map((c) => c.text).join('\n') : undefined;

  // Build the export based on kind
  const specExport: SpecExport = {
    id: exportName,
    name: exportName,
    kind,
    ...(description && { description }),
    source: {
      package: resolvedModule.packageName,
      version: resolvedModule.packageVersion,
      file: resolvedModule.resolvedPath,
    },
  };

  // For functions, extract signatures
  if (kind === 'function') {
    const type = checker.getTypeOfSymbol(resolvedSymbol);
    const callSignatures = type.getCallSignatures();

    if (callSignatures.length > 0) {
      (specExport as Record<string, unknown>).signatures = buildSignatures(
        callSignatures,
        checker,
        ctx,
      );
    }
  } else if (kind === 'interface' || kind === 'type' || kind === 'class') {
    // For types/interfaces/classes, build the schema
    const type = checker.getTypeOfSymbol(resolvedSymbol);
    registerReferencedTypes(type, ctx);
    const schema = buildSchema(type, checker, ctx);
    specExport.schema = schema;
  } else if (kind === 'variable') {
    // For variables, build the schema
    const type = checker.getTypeOfSymbol(resolvedSymbol);
    registerReferencedTypes(type, ctx);
    const schema = buildSchema(type, checker, ctx);
    specExport.schema = schema;
  }

  return specExport;
}
