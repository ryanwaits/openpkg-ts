import * as fs from 'node:fs';
import * as path from 'node:path';
import type {
  EntryPointDetectionMethod,
  OpenPkg,
  SpecExport,
  SpecInlineTag,
  SpecMember,
  SpecSchema,
  SpecSignature,
} from '@openpkg-ts/spec';
import { SCHEMA_URL, SCHEMA_VERSION } from '@openpkg-ts/spec';
import ts from 'typescript';
import { resolveAliasSymbol, resolveExportTarget } from '../ast/resolve';
import { claimExportedTypeIds, isLibFile, packageNameFromPath } from '../ast/type-identity';
import { isSymbolDeprecated, parseInlineTags } from '../ast/utils';
import { createProgram } from '../compiler/program';
import { extractStandardSchemasFromProject } from '../schema/standard-schema';
import { serializeClass, serializeConstructSignatures } from '../serializers/classes';
import { createContext, type SerializerContext } from '../serializers/context';
import { serializeEnum } from '../serializers/enums';
import { withExpansionBudget } from '../serializers/expansion-budget';
import { serializeFunctionExport } from '../serializers/functions';
import { serializeInterface, serializeMergedTypeSide } from '../serializers/interfaces';
import { buildSignatures } from '../serializers/shared';
import { serializeTypeAlias } from '../serializers/type-aliases';
import { serializeDefaultExpression, serializeVariable } from '../serializers/variables';
import type {
  Diagnostic,
  ExportTracker,
  ExtractOptions,
  ExtractResult,
  TypeReference,
} from '../types';
import { registerReferencedTypes } from '../types/parameters';
import { buildSchema } from '../types/schema-builder';
import { normalizeExport, normalizeType } from '../types/schema-normalizer';
import {
  extractExternalExport,
  matchesExternalPattern,
  resolveExternalModule,
} from './external-resolver';
import { mergeRuntimeSchemas } from './schema-merger';
import { clearTypeDefinitionCache, getRegexCache } from './type-cache';
import { createExternalExpansionPredicate, expandReachableTypes } from './type-expansion';
import {
  BUILTIN_TYPES as BUILTIN_TYPES_SET,
  buildVerificationSummary,
  collectAllRefsWithContext,
  collectForgottenExports,
} from './verification';

// Re-export for API compatibility
export { clearTypeDefinitionCache } from './type-cache';
export { isExternalType } from './verification';

/** Yield to event loop every N exports to allow spinner animation */
const YIELD_BATCH_SIZE = 5;

/**
 * Match export name against pattern (supports * wildcards)
 */
function matchesPattern(name: string, pattern: string): boolean {
  if (!pattern.includes('*')) return name === pattern;

  const regexCache = getRegexCache();
  let regex = regexCache.get(pattern);
  if (!regex) {
    regex = new RegExp(`^${pattern.replace(/\*/g, '.*')}$`);
    regexCache.set(pattern, regex);
  }
  return regex.test(name);
}

/**
 * Check if export should be included based on only/ignore filters
 */
function shouldIncludeExport(name: string, only?: string[], ignore?: string[]): boolean {
  if (ignore?.some((p) => matchesPattern(name, p))) return false;
  if (only && only.length > 0) {
    return only.some((p) => matchesPattern(name, p));
  }
  return true;
}

/**
 * Extract API specification from TypeScript source files.
 *
 * Analyzes exports from the entry file, serializes them to OpenPkg spec format,
 * and detects forgotten exports (types referenced but not exported).
 *
 * @param options - Extraction configuration
 * @param options.entryFile - Path to the entry TypeScript file
 * @param options.baseDir - Base directory for resolving imports (defaults to entryFile dir)
 * @param options.content - Optional in-memory source content (skips file read)
 * @param options.maxTypeDepth - Max depth for nested type resolution (default: 10)
 * @param options.only - Glob patterns to include (e.g., ["get*", "create*"])
 * @param options.ignore - Glob patterns to exclude (e.g., ["*Internal", "_*"])
 * @param options.onProgress - Callback fired for each export: (current, total, name) => void
 * @param options.isDtsSource - Set true when extracting from .d.ts (declaration-only generation metadata)
 * @param options.externals - Config for resolving re-exports from external packages
 *
 * @returns Promise resolving to extraction result
 * @returns result.spec - The OpenPkg specification object
 * @returns result.diagnostics - Warnings/errors encountered during extraction
 * @returns result.verification - Stats comparing discovered vs extracted exports
 * @returns result.forgottenExports - Types referenced but not exported (internal only)
 *
 * @example
 * ```ts
 * import { extract } from '@openpkg-ts/sdk';
 *
 * const { spec, diagnostics } = await extract({
 *   entryFile: './src/index.ts',
 *   onProgress: (i, total, name) => console.log(`${i}/${total}: ${name}`),
 * });
 * ```
 *
 * @remarks
 * - Caches are cleared before and after extraction (via try/finally)
 * - Progress callback yields to event loop every 5 exports for UI responsiveness
 * - External package re-exports require explicit `externals.include` patterns
 */
export async function extract(options: ExtractOptions): Promise<ExtractResult> {
  // Clear caches at start of each extraction
  clearTypeDefinitionCache();

  try {
    const {
      entryFile,
      baseDir,
      content,
      maxTypeDepth,
      includeSchema,
      only,
      ignore,
      onProgress,
      isDtsSource,
      includePrivate,
      maxProperties,
      onTruncation,
    } = options;

    const diagnostics: Diagnostic[] = [];
    let exports: SpecExport[] = [];

    // Create program
    const result = createProgram({ entryFile, baseDir, content });
    const { program, sourceFile } = result;

    if (!sourceFile) {
      return {
        spec: createEmptySpec(entryFile, includeSchema, isDtsSource, options.entryPointSource),
        diagnostics: [
          {
            message: `Entry file not found: ${entryFile}. Specify with: drift list src/index.ts`,
            severity: 'error',
          },
        ],
      };
    }

    const typeChecker = program.getTypeChecker();

    // Get module symbol and its exports (handles re-exports properly)
    const moduleSymbol = typeChecker.getSymbolAtLocation(sourceFile);
    if (!moduleSymbol) {
      return {
        spec: createEmptySpec(entryFile, includeSchema, isDtsSource, options.entryPointSource),
        diagnostics: [
          {
            message: `No exports found in ${entryFile}. Is this the right entry point?`,
            severity: 'error',
          },
        ],
      };
    }

    const exportedSymbols = typeChecker.getExportsOfModule(moduleSymbol);

    if (exportedSymbols.length === 0) {
      return {
        spec: createEmptySpec(entryFile, includeSchema, isDtsSource, options.entryPointSource),
        diagnostics: [
          {
            message: `No exports found in ${entryFile}. Is this the right entry point?`,
            severity: 'error',
          },
        ],
      };
    }

    // First pass: collect all export names so we can skip them when registering types
    const exportedIds = new Set<string>();
    for (const symbol of exportedSymbols) {
      exportedIds.add(symbol.getName());
    }

    // Track status of each discovered export through serialization pipeline
    const exportTracker = new Map<string, ExportTracker>();
    for (const symbol of exportedSymbols) {
      const name = symbol.getName();
      const included = shouldIncludeExport(name, only, ignore);
      exportTracker.set(name, {
        name,
        discovered: true,
        status: included ? 'pending' : 'skipped',
        ...(included ? {} : { skipReason: 'filtered' }),
      });
    }

    const mergedTypeSides: Array<{ index: number; symbol: ts.Symbol; ontoClass: boolean }> = [];

    const followExternal = options.followExternal;

    const ctx = createContext(program, sourceFile, {
      maxTypeDepth,
      includePrivate,
      maxProperties,
      onTruncation,
      // Ambient/external types outside this scope register as opaque stubs.
      // followExternal: true (or listing a package) restores full expansion.
      shouldExpandExternal: createExternalExpansionPredicate({
        followExternal,
        workspacePackages: result.workspacePackages ?? new Map(),
        checker: typeChecker,
        program,
      }),
      // Used to package-scope the ids of same-named types across packages.
      workspacePackages: result.workspacePackages ?? new Map(),
    });
    ctx.exportedIds = exportedIds;
    claimExportedTypeIds(exportedSymbols, ctx);

    // Pre-filter exports to get accurate total for progress reporting
    const filteredSymbols = exportedSymbols.filter((s) =>
      shouldIncludeExport(s.getName(), only, ignore),
    );
    const total = filteredSymbols.length;

    for (let i = 0; i < filteredSymbols.length; i++) {
      const symbol = filteredSymbols[i];
      const exportName = symbol.getName();
      const tracker = exportTracker.get(exportName);
      if (!tracker) continue;

      // Report progress and yield to event loop periodically
      onProgress?.(i + 1, total, exportName);
      if (i > 0 && i % YIELD_BATCH_SIZE === 0) {
        await new Promise((r) => setImmediate(r));
      }

      try {
        const { declaration, targetSymbol, isTypeOnly } = resolveExportTarget(
          symbol,
          typeChecker,
          program,
        );
        if (!declaration) {
          // Check if this is a re-export from an external package
          let externalPackage: string | undefined;

          // Method 1: Check if any declarations point to node_modules
          const allDecls = [...(targetSymbol.declarations ?? []), ...(symbol.declarations ?? [])];
          for (const decl of allDecls) {
            const sf = decl.getSourceFile();
            const pkg = sf && packageNameFromPath(sf.fileName);
            if (pkg) {
              externalPackage = pkg;
              break;
            }
            // Method 2: Check if this is an export specifier with a module specifier
            if (ts.isExportSpecifier(decl)) {
              const exportDecl = decl.parent?.parent;
              if (exportDecl && ts.isExportDeclaration(exportDecl) && exportDecl.moduleSpecifier) {
                const moduleText = exportDecl.moduleSpecifier.getText().slice(1, -1); // Remove quotes
                // Check if it's a package (not relative path)
                if (!moduleText.startsWith('.') && !moduleText.startsWith('/')) {
                  externalPackage = moduleText;
                  break;
                }
              }
            }
          }

          if (externalPackage) {
            // Check if we should try to resolve this external package
            const shouldResolve = matchesExternalPattern(
              externalPackage,
              options.externals?.include,
              options.externals?.exclude,
            );

            if (shouldResolve) {
              // Try to resolve the external module
              const resolvedModule = resolveExternalModule(
                externalPackage,
                sourceFile.fileName,
                program.getCompilerOptions(),
              );

              if (resolvedModule) {
                // Extract the export from the resolved module
                const visitedExternals = new Set<string>();
                const extractedExport = extractExternalExport(
                  exportName,
                  resolvedModule,
                  program,
                  ctx,
                  visitedExternals,
                );

                if (extractedExport) {
                  exports.push(extractedExport);
                  tracker.status = 'success';
                  tracker.kind = extractedExport.kind;
                  continue;
                }
              }
            }

            // Fall back to external stub if resolution wasn't attempted or failed
            const externalExport: SpecExport = {
              id: exportName,
              name: exportName,
              kind: 'external',
              source: {
                package: externalPackage,
              },
            };
            exports.push(externalExport);
            tracker.status = 'success';
            tracker.kind = 'external';
          } else {
            tracker.status = 'skipped';
            tracker.skipReason = 'no-declaration';
          }
          continue;
        }

        const exp = withExpansionBudget(ctx, exportName, () =>
          serializeDeclaration(declaration, symbol, exportName, ctx, isTypeOnly),
        );
        if (exp) {
          const typeSide = mergedTypeSideOf(exp, declaration, targetSymbol, ctx);
          if (typeSide) {
            mergedTypeSides.push({
              index: exports.length,
              symbol: typeSide,
              ontoClass: ts.isClassDeclaration(declaration),
            });
          }
          exports.push(exp);
          tracker.status = 'success';
          tracker.kind = exp.kind;
        } else {
          tracker.status = 'skipped';
          tracker.skipReason = 'internal';
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        tracker.status = 'failed';
        tracker.error = errorMsg;
        diagnostics.push({
          message: `Failed to serialize '${exportName}': ${errorMsg}`,
          severity: 'warning',
          code: 'SERIALIZATION_FAILED',
        });
      }
    }

    // Value + type under one name (`interface Foo` + `const Foo`, or an
    // interface merged onto a class): the export carries the type's members.
    // The type side is built under a budget of its own, like a registered type.
    for (const { index, symbol, ontoClass } of mergedTypeSides) {
      exports[index] = withExpansionBudget(ctx, exports[index].name, () =>
        withMergedTypeSide(exports[index], symbol, ctx, ontoClass),
      );
    }

    // Build verification summary from tracker
    const verification = buildVerificationSummary(
      exportedSymbols.length,
      exports.length,
      exportTracker,
    );

    // Get package metadata
    const meta = await getPackageMeta(entryFile, baseDir);

    // Reachability expansion: register named types the exported surface
    // references but flattening erased (Omit targets, heritage bases,
    // inherited signature types). Workspace deps by default; see followExternal.
    expandReachableTypes(filteredSymbols, ctx, {
      followExternal,
      workspacePackages: result.workspacePackages ?? new Map(),
      entryFile,
    });

    if (ctx.budgetExceeded) {
      diagnostics.push({
        message: `Stopped expanding some types after hitting the schema expansion budget${exhaustedBudgetNote(ctx)}`,
        severity: 'warning',
        code: 'TYPE_EXPANSION_LIMIT',
      });
    }

    // Post-process: register any $ref targets missing from the type registry.
    // Iterates until stable since newly registered types may introduce new $ref targets.
    {
      const symFlags = ts.SymbolFlags.Type | ts.SymbolFlags.Interface | ts.SymbolFlags.Class;
      const maxPasses = 5;
      for (let pass = 0; pass < maxPasses; pass++) {
        const allRefs = new Map<string, TypeReference[]>();
        for (const exp of exports) {
          collectAllRefsWithContext(exp, allRefs, {
            exportName: exp.id || exp.name,
            location: 'property',
            path: [],
          });
        }
        for (const t of ctx.typeRegistry.getAll()) {
          collectAllRefsWithContext(t, allRefs, {
            exportName: t.id,
            location: 'property',
            path: [],
          });
        }
        let added = 0;
        for (const [typeName] of allRefs) {
          if (ctx.typeRegistry.has(typeName)) continue;
          if (BUILTIN_TYPES_SET.has(typeName)) continue;

          const tsType = findTypeInProgram(typeName, typeChecker, program, sourceFile, symFlags);
          if (tsType) {
            ctx.typeRegistry.registerType(tsType, ctx);
            added++;
          }
        }
        if (added === 0) break;
      }
    }

    const types = ctx.typeRegistry.getAll();

    // Check for forgotten exports (refs to types not defined)
    const projectBaseDir = baseDir ?? path.dirname(entryFile);
    const definedTypes = new Set(types.map((t) => t.id));
    const forgottenExports = collectForgottenExports(
      exports,
      types,
      program,
      sourceFile,
      exportedIds,
      projectBaseDir,
      definedTypes,
    );
    for (const forgotten of forgottenExports) {
      const refSummary = forgotten.referencedBy
        .slice(0, 3)
        .map((r) => `${r.exportName} (${r.location})`)
        .join(', ');
      const moreRefs =
        forgotten.referencedBy.length > 3 ? ` +${forgotten.referencedBy.length - 3} more` : '';

      if (forgotten.isExternal) {
        diagnostics.push({
          message: `External type '${forgotten.name}' referenced by: ${refSummary}${moreRefs}`,
          severity: 'info',
          code: 'EXTERNAL_TYPE_REF',
          suggestion: forgotten.definedIn
            ? `Type is from: ${forgotten.definedIn}`
            : 'Type is from an external package',
        });
      } else {
        diagnostics.push({
          message: `Forgotten export: '${forgotten.name}' referenced by: ${refSummary}${moreRefs}`,
          severity: 'warning',
          code: 'FORGOTTEN_EXPORT',
          suggestion: forgotten.fix ?? `Export this type from your public API`,
          location: forgotten.definedIn ? { file: forgotten.definedIn } : undefined,
        });
      }
    }

    // Check for external type stubs (info only - external stubs are expected)
    const externalTypes = types.filter((t) => t.kind === 'external');
    if (externalTypes.length > 0) {
      diagnostics.push({
        message: `${externalTypes.length} external type(s) from dependencies: ${externalTypes
          .slice(0, 5)
          .map((t) => t.id)
          .join(', ')}${externalTypes.length > 5 ? '...' : ''}`,
        severity: 'info',
        code: 'EXTERNAL_TYPES',
      });
    }

    // Runtime Standard JSON Schema extraction (hybrid mode)
    let runtimeMetadata: ExtractResult['runtimeSchemas'] | undefined;

    if (options.schemaExtraction === 'hybrid') {
      const projectBaseDir = baseDir || path.dirname(entryFile);

      const runtimeResult = await extractStandardSchemasFromProject(entryFile, projectBaseDir, {
        target: 'draft-2020-12',
        timeout: 15000,
      });

      if (runtimeResult.schemas.size > 0) {
        const mergeResult = mergeRuntimeSchemas(exports, runtimeResult.schemas);
        exports = mergeResult.exports;

        // Include extraction method in metadata
        const method =
          runtimeResult.info?.method === 'direct-ts'
            ? `direct-ts (${runtimeResult.info.runtime})`
            : 'compiled';

        runtimeMetadata = {
          extracted: runtimeResult.schemas.size,
          merged: mergeResult.merged,
          vendors: [...new Set([...runtimeResult.schemas.values()].map((s) => s.vendor))],
          errors: runtimeResult.errors,
          warnings: runtimeResult.warnings,
          method,
        };
      }

      // Add runtime extraction errors as diagnostics
      for (const error of runtimeResult.errors) {
        diagnostics.push({
          message: `Runtime schema extraction: ${error}`,
          severity: 'warning',
          code: 'RUNTIME_SCHEMA_ERROR',
        });
      }

      // Add runtime extraction warnings as diagnostics
      for (const warning of runtimeResult.warnings) {
        diagnostics.push({
          message: `Schema extraction skipped${warning.exportName ? ` (${warning.exportName})` : ''}: ${warning.message}`,
          severity: 'warning',
          code: warning.code,
        });
      }
    }

    // Normalize exports and types to JSON Schema 2020-12 format
    // This happens after all extraction (static + runtime schema merging) is complete
    const normalizedExports = exports.map((exp) => normalizeExport(exp));
    const normalizedTypes = types.map((t) => normalizeType(t));

    const spec: OpenPkg = {
      ...(includeSchema ? { $schema: SCHEMA_URL } : {}),
      openpkg: SCHEMA_VERSION,
      meta,
      exports: normalizedExports,
      types: normalizedTypes,
      generation: {
        generator: '@openpkg-ts/sdk',
        timestamp: new Date().toISOString(),
        mode: isDtsSource ? 'declaration-only' : 'source',
        ...generationEntry(entryFile, options.entryPointSource),
        ...(options.schemaExtraction === 'hybrid' ? { schemaExtraction: 'hybrid' } : {}),
        ...(isDtsSource && {
          limitations: ['No JSDoc descriptions', 'No @example tags', 'No @param descriptions'],
        }),
        // Include skipped exports in generation metadata
        ...(verification.details.skipped.length > 0 && {
          skipped: verification.details.skipped,
        }),
      },
    };

    // Filter to only internal forgotten exports (for fix generation)
    const internalForgotten = forgottenExports.filter((f) => !f.isExternal);

    // Add diagnostic if any exports failed verification
    if (verification.failed > 0) {
      const failedNames = verification.details.failed.map((f) => f.name).join(', ');
      diagnostics.push({
        message: `Export verification: ${verification.failed} export(s) failed: ${failedNames}`,
        severity: 'warning',
        code: 'EXPORT_VERIFICATION_FAILED',
        suggestion: 'Check serialization errors for these exports',
      });
    }

    return {
      spec,
      diagnostics,
      verification,
      ...(internalForgotten.length > 0 ? { forgottenExports: internalForgotten } : {}),
      ...(runtimeMetadata ? { runtimeSchemas: runtimeMetadata } : {}),
    };
  } finally {
    // Clear caches after extraction to prevent memory leaks
    clearTypeDefinitionCache();
  }
}

function serializeDeclaration(
  declaration: ts.Declaration,
  exportSymbol: ts.Symbol,
  exportName: string,
  ctx: SerializerContext,
  isTypeOnly = false,
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
  } else if (ts.isVariableDeclaration(declaration) || ts.isBindingElement(declaration)) {
    const varStatement = variableStatementOf(declaration);
    if (varStatement) {
      // Check if it's an arrow/function expression - serialize as function instead of variable
      if (
        ts.isVariableDeclaration(declaration) &&
        declaration.initializer &&
        (ts.isArrowFunction(declaration.initializer) ||
          ts.isFunctionExpression(declaration.initializer))
      ) {
        const varName = ts.isIdentifier(declaration.name)
          ? declaration.name.text
          : declaration.name.getText();
        result = serializeFunctionExport(declaration.initializer, ctx, varName, declaration.type);
      } else {
        result = serializeVariable(declaration, varStatement, ctx);
        if (result?.kind === 'variable') {
          const type = ctx.typeChecker.getTypeAtLocation(declaration);
          result = withCallableKind(result, type, callSignaturesForVariable(declaration, ctx), ctx);
        }
      }
    }
  } else if (ts.isExportAssignment(declaration) && !declaration.isExportEquals) {
    // `export default <expression>`: no binding to resolve to, the statement
    // is the declaration. (An identifier is an alias and never lands here.)
    const expression = skipOuterExpressions(declaration.expression);
    if (ts.isArrowFunction(expression) || ts.isFunctionExpression(expression)) {
      result = serializeFunctionExport(expression, ctx, exportName, undefined, declaration);
    } else {
      // What an importer sees: the symbol's type, widened like a `let`.
      const type = ctx.typeChecker.getTypeOfSymbol(exportSymbol);
      result = withCallableKind(
        serializeDefaultExpression(declaration, exportSymbol, type, ctx),
        type,
        type.getCallSignatures(),
        ctx,
      );
    }
  } else if (
    ts.isNamespaceExport(declaration) ||
    ts.isModuleDeclaration(declaration) ||
    ts.isNamespaceImport(declaration) ||
    ts.isSourceFile(declaration)
  ) {
    try {
      result = serializeNamespaceExport(exportSymbol, exportName, ctx);
    } catch {
      // Fallback for namespace/module exports with parent chain issues
      result = {
        id: exportName,
        name: exportName,
        kind: 'namespace',
        tags: [],
        members: [],
        examples: [],
      };
    }
  }

  if (result) {
    result = withExportName(result, exportName);
    const localName = exportName === 'default' && defaultLocalName(declaration, exportSymbol);
    if (localName) result = { ...result, localName };
    // Add typeOnly flag for type-only re-exports
    if (isTypeOnly) {
      result = {
        ...result,
        flags: { ...(result.flags ?? {}), typeOnly: true },
      };
    }
    // Check export specifier symbol for @deprecated (covers re-export deprecation)
    if (!result.deprecated) {
      const { deprecated, reason: deprecationReason } = isSymbolDeprecated(exportSymbol);
      if (deprecated) {
        result = { ...result, deprecated: true, deprecationReason };
      }
    }
  }

  return result;
}

function serializeNamespaceExport(
  symbol: ts.Symbol,
  exportName: string,
  ctx: SerializerContext,
): SpecExport {
  const { description, tags, examples } = getJSDocFromExportSymbol(symbol);
  const inlineTags = parseInlineTags(description);

  // Extract namespace members
  const members: SpecMember[] = [];
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
  const nsExports = checker.getExportsOfModule(targetSymbol);

  for (const memberSymbol of nsExports) {
    const memberName = memberSymbol.getName();
    const member = serializeNamespaceMember(memberSymbol, memberName, ctx);
    if (member) {
      members.push(member);
    }
  }

  return {
    id: exportName,
    name: exportName,
    kind: 'namespace',
    description,
    tags,
    ...(examples.length > 0 ? { examples } : {}),
    ...(members.length > 0 ? { members } : {}),
    ...(inlineTags ? { inlineTags } : {}),
  };
}

function serializeNamespaceMember(
  symbol: ts.Symbol,
  memberName: string,
  ctx: SerializerContext,
): SpecMember | null {
  const checker = ctx.program.getTypeChecker();

  // Resolve alias if needed
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

  if (!declaration) return null;

  const type = checker.getTypeAtLocation(declaration);
  const callSignatures = type.getCallSignatures();
  const { deprecated } = isSymbolDeprecated(targetSymbol);

  // Determine kind
  let kind: string = 'variable';
  if (ts.isFunctionDeclaration(declaration) || ts.isFunctionExpression(declaration)) {
    kind = 'function';
  } else if (ts.isClassDeclaration(declaration)) {
    kind = 'class';
  } else if (ts.isInterfaceDeclaration(declaration)) {
    kind = 'interface';
  } else if (ts.isTypeAliasDeclaration(declaration)) {
    kind = 'type';
  } else if (ts.isEnumDeclaration(declaration)) {
    kind = 'enum';
  } else if (ts.isVariableDeclaration(declaration)) {
    // Check if it's a function assigned to a variable
    if (callSignatures.length > 0) {
      kind = 'function';
    }
  }

  // Get description from JSDoc
  const docComment = targetSymbol.getDocumentationComment(checker);
  const description = docComment.map((c) => c.text).join('\n') || undefined;

  // Build signatures for functions
  let signatures: SpecSignature[] | undefined;
  if (kind === 'function' && callSignatures.length > 0) {
    signatures = buildSignatures(callSignatures, checker, ctx);
  }

  // Build schema for non-function members
  let schema: SpecSchema | undefined;
  if (kind !== 'function') {
    registerReferencedTypes(type, ctx);
    schema = buildSchema(type, ctx.typeChecker, ctx);
  }

  const inlineTags = parseInlineTags(description);

  return {
    name: memberName,
    kind,
    ...(description ? { description } : {}),
    ...(signatures ? { signatures } : {}),
    ...(schema ? { schema } : {}),
    ...(inlineTags ? { inlineTags } : {}),
    ...(deprecated ? { flags: { deprecated: true } } : {}),
  };
}

/**
 * Flatten a JSDoc comment or tag body to text.
 *
 * Uses TypeScript's own serializer rather than mapping over `.text`: a JSDocLink
 * node's `.text` holds only what follows the entity name, so the naive map drops
 * the link target entirely (`{@link Foo}` collapses to an empty string).
 */
function flattenJSDocComment(comment: string | ts.NodeArray<ts.JSDocComment> | undefined): string {
  if (comment === undefined) return '';
  return typeof comment === 'string' ? comment : (ts.getTextOfJSDocComment(comment) ?? '');
}

function getJSDocFromExportSymbol(symbol: ts.Symbol): {
  description?: string;
  tags: Array<{ name: string; text: string; inlineTags?: SpecInlineTag[] }>;
  examples: string[];
} {
  const tags: Array<{ name: string; text: string; inlineTags?: SpecInlineTag[] }> = [];
  const examples: string[] = [];

  const decl = symbol.declarations?.[0];
  if (decl) {
    const exportDecl = ts.isNamespaceExport(decl) ? decl.parent : decl;
    if (exportDecl && ts.isExportDeclaration(exportDecl)) {
      const jsDocs = ts.getJSDocCommentsAndTags(exportDecl);
      for (const doc of jsDocs) {
        if (ts.isJSDoc(doc) && doc.comment) {
          const commentText = flattenJSDocComment(doc.comment);
          if (commentText) {
            return {
              description: commentText,
              tags: extractJSDocTags(doc),
              examples: extractExamples(doc),
            };
          }
        }
      }
    }
  }

  const docComment = symbol.getDocumentationComment(undefined);
  const description = docComment.map((c) => c.text).join('\n') || undefined;

  const jsTags = symbol.getJsDocTags();
  for (const tag of jsTags) {
    const text = tag.text?.map((t) => t.text).join('') ?? '';
    if (tag.name === 'example') {
      examples.push(text);
    } else {
      tags.push({ name: tag.name, text });
    }
  }

  return { description, tags, examples };
}

function extractJSDocTags(
  doc: ts.JSDoc,
): Array<{ name: string; text: string; inlineTags?: SpecInlineTag[] }> {
  const tags: Array<{ name: string; text: string; inlineTags?: SpecInlineTag[] }> = [];
  for (const tag of doc.tags ?? []) {
    if (tag.tagName.text !== 'example') {
      const text = flattenJSDocComment(tag.comment);
      const inlineTags = parseInlineTags(text);
      tags.push({ name: tag.tagName.text, text, ...(inlineTags ? { inlineTags } : {}) });
    }
  }
  return tags;
}

function extractExamples(doc: ts.JSDoc): string[] {
  const examples: string[] = [];
  for (const tag of doc.tags ?? []) {
    if (tag.tagName.text === 'example') {
      const text = flattenJSDocComment(tag.comment);
      if (text) examples.push(text);
    }
  }
  return examples;
}

/**
 * Statement declaring a variable or a name bound by destructuring; binding
 * elements nest under patterns (`const [a, { b }] = init`).
 */
function variableStatementOf(
  declaration: ts.VariableDeclaration | ts.BindingElement,
): ts.VariableStatement | undefined {
  let node: ts.Node = declaration;
  while (ts.isBindingElement(node) || ts.isBindingName(node)) node = node.parent;
  const statement = node.parent?.parent;
  return statement && ts.isVariableStatement(statement) ? statement : undefined;
}

/** Parentheses and type assertions around a value (`(fn) satisfies T`, `{} as T`). */
function skipOuterExpressions(expression: ts.Expression): ts.Expression {
  let node = expression;
  while (
    ts.isParenthesizedExpression(node) ||
    ts.isAsExpression(node) ||
    ts.isSatisfiesExpression(node) ||
    ts.isTypeAssertionExpression(node) ||
    ts.isNonNullExpression(node)
  ) {
    node = node.expression;
  }
  return node;
}

/** A value with construct signatures is a class; with call signatures, a function. */
function withCallableKind(
  entry: SpecExport,
  type: ts.Type,
  callSigs: readonly ts.Signature[],
  ctx: SerializerContext,
): SpecExport {
  const constructSigs = type.getConstructSignatures();
  if (constructSigs.length > 0) {
    return {
      ...entry,
      kind: 'class',
      signatures: serializeConstructSignatures(constructSigs, ctx),
    };
  }
  if (callSigs.length === 0) return entry;
  return {
    ...entry,
    kind: 'function',
    signatures: buildSignatures(callSigs, ctx.typeChecker, ctx),
  };
}

function callSignaturesForVariable(
  declaration: ts.VariableDeclaration | ts.BindingElement,
  ctx: SerializerContext,
): readonly ts.Signature[] {
  const checker = ctx.typeChecker;
  if (
    ts.isVariableDeclaration(declaration) &&
    declaration.type &&
    ts.isTypeReferenceNode(declaration.type)
  ) {
    const nameNode = ts.isQualifiedName(declaration.type.typeName)
      ? declaration.type.typeName.right
      : declaration.type.typeName;
    const raw = checker.getSymbolAtLocation(nameNode);
    if (raw) {
      const symbol = resolveAliasSymbol(raw, checker, undefined, ctx.program);
      const iface = symbol.declarations?.find((d) => ts.isInterfaceDeclaration(d));
      try {
        const declared = checker.getDeclaredTypeOfSymbol(symbol);
        const sigs = declared.getCallSignatures();
        if (sigs.length > 0) return sigs;
        if (iface) {
          const fromDecl = checker.getTypeAtLocation(iface).getCallSignatures();
          if (fromDecl.length > 0) return fromDecl;
        }
      } catch {
        if (iface) {
          try {
            return checker.getTypeAtLocation(iface).getCallSignatures();
          } catch {
            /* fall through */
          }
        }
      }
    }
  }
  return checker.getTypeAtLocation(declaration).getCallSignatures();
}

/**
 * Identifier a default export goes by in source: the declaration's own name,
 * else the name it is exported under (`export default foo`, `export { foo as default }`).
 * Undefined for anonymous defaults.
 */
function defaultLocalName(
  declaration: ts.Declaration,
  exportSymbol: ts.Symbol,
): string | undefined {
  const declared = ts.getNameOfDeclaration(declaration);
  if (declared && ts.isIdentifier(declared) && declared.text !== 'default') return declared.text;

  for (const decl of exportSymbol.declarations ?? []) {
    if (ts.isExportAssignment(decl) && ts.isIdentifier(decl.expression)) {
      return decl.expression.text;
    }
    if (ts.isExportSpecifier(decl) && decl.propertyName && ts.isIdentifier(decl.propertyName)) {
      if (decl.propertyName.text !== 'default') return decl.propertyName.text;
    }
  }
  return undefined;
}

function isValueDeclaration(declaration: ts.Declaration): boolean {
  return (
    ts.isVariableDeclaration(declaration) ||
    ts.isBindingElement(declaration) ||
    ts.isFunctionDeclaration(declaration)
  );
}

function hasTypeSide(symbol: ts.Symbol): boolean {
  return (symbol.flags & (ts.SymbolFlags.Interface | ts.SymbolFlags.TypeAlias)) !== 0;
}

/**
 * Symbol whose type members the export should carry, if any: the export's own
 * merged type side, else for a constructor value of another name
 * (`const RealError: Ctor<Err>`) the type it constructs.
 */
function mergedTypeSideOf(
  exp: SpecExport,
  declaration: ts.Declaration,
  symbol: ts.Symbol,
  ctx: SerializerContext,
): ts.Symbol | undefined {
  if (ts.isClassDeclaration(declaration)) {
    return symbol.flags & ts.SymbolFlags.Interface ? symbol : undefined;
  }
  if (exp.members || !isValueDeclaration(declaration)) return undefined;
  if (hasTypeSide(symbol)) return symbol;
  if (exp.kind !== 'class') return undefined;

  const [construct] = ctx.typeChecker.getTypeAtLocation(declaration).getConstructSignatures();
  const instance = construct?.getReturnType();
  const constructed = instance && (instance.aliasSymbol ?? instance.getSymbol());
  if (!constructed || !hasTypeSide(constructed)) return undefined;
  // A foreign or lib instance type (`new () => Date`) stays a reference.
  if (ctx.shouldExpandExternal && !ctx.shouldExpandExternal(constructed)) return undefined;
  return constructed;
}

/**
 * The value's own docs win; the type side fills what is missing. `extends` and
 * type parameters describe the instance type, so only a constructor takes them
 * (a generic interface does not make its companion function generic).
 */
function withMergedTypeSide(
  entry: SpecExport,
  symbol: ts.Symbol,
  ctx: SerializerContext,
  ontoClass: boolean,
): SpecExport {
  const typeSide = serializeMergedTypeSide(symbol, ctx);
  if (!typeSide) return entry;
  const { members, description, tags, ...instanceType } = typeSide;
  // A class declaration keeps its own members, `extends` and type parameters.
  const own = new Set(entry.members?.map((m) => m.name));
  return {
    ...entry,
    members: [...(entry.members ?? []), ...(members ?? []).filter((m) => !own.has(m.name))],
    ...(entry.kind === 'class' && !ontoClass ? instanceType : {}),
    ...(entry.description ? {} : { description, tags: [...(entry.tags ?? []), ...(tags ?? [])] }),
  };
}

/** Names the exports and types whose own budget ran out (the rest only deferred a type). */
function exhaustedBudgetNote(ctx: SerializerContext): string {
  const owners = [...new Set(ctx.exhaustedBudgets)];
  if (owners.length === 0) return '';
  const shown = owners.slice(0, 10).join(', ');
  return `: ${shown}${owners.length > 10 ? ` (+${owners.length - 10} more)` : ''}`;
}

function withExportName(entry: SpecExport, exportName: string): SpecExport {
  if (entry.name === exportName) {
    return entry;
  }
  return {
    ...entry,
    id: exportName,
    name: exportName,
  };
}

function generationEntry(entryFile: string, source?: EntryPointDetectionMethod) {
  const rel = path.relative(process.cwd(), entryFile).split(path.sep).join('/');
  return {
    entryPoint: rel || entryFile,
    entryPointSource: source ?? ('explicit' as const),
  };
}

function createEmptySpec(
  entryFile: string,
  includeSchema?: boolean,
  isDtsSource?: boolean,
  entryPointSource?: EntryPointDetectionMethod,
): OpenPkg {
  return {
    ...(includeSchema ? { $schema: SCHEMA_URL } : {}),
    openpkg: SCHEMA_VERSION,
    meta: { name: path.basename(entryFile, path.extname(entryFile)) },
    exports: [],
    generation: {
      generator: '@openpkg-ts/sdk',
      timestamp: new Date().toISOString(),
      mode: isDtsSource ? 'declaration-only' : 'source',
      ...generationEntry(entryFile, entryPointSource),
      ...(isDtsSource && {
        limitations: ['No JSDoc descriptions', 'No @example tags', 'No @param descriptions'],
      }),
    },
  };
}

/**
 * Find a type by name across the program's source files.
 * Tries entry file scope first (fast path), then searches .d.ts files
 * for transitive external types not directly visible from the entry.
 */
function findTypeInProgram(
  name: string,
  checker: ts.TypeChecker,
  program: ts.Program,
  sourceFile: ts.SourceFile,
  symFlags: ts.SymbolFlags,
): ts.Type | undefined {
  // Fast path: entry file scope
  const localSym = checker.resolveName(name, sourceFile, symFlags, false);
  if (localSym) return checker.getDeclaredTypeOfSymbol(localSym);

  // Determine the entry file's directory to distinguish "own" vs "external" source files
  const entryDir = path.dirname(sourceFile.fileName);

  // Search all source files reachable from the program.
  // Includes .d.ts files AND .ts files from other packages (monorepo siblings, node_modules).
  // Skips ambient globals and the entry package's own source files (already covered above).
  for (const sf of program.getSourceFiles()) {
    const fn = sf.fileName;
    // Skip ambient globals
    if (isLibFile(fn)) continue;
    if (fn.includes('/@types/node/') || fn.includes('\\@types\\node\\')) continue;
    // Skip entry file's own package (already searched via entry scope)
    if (fn.startsWith(entryDir)) continue;

    const sym = checker.resolveName(name, sf, symFlags, false);
    if (sym) return checker.getDeclaredTypeOfSymbol(sym);
  }
  return undefined;
}

async function getPackageMeta(
  entryFile: string,
  baseDir?: string,
): Promise<{ name: string; version?: string; description?: string }> {
  let dir = baseDir ?? path.dirname(entryFile);

  // Walk up directory tree to find nearest package.json
  while (dir !== path.dirname(dir)) {
    const pkgPath = path.join(dir, 'package.json');
    try {
      if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        return {
          name: pkg.name ?? path.basename(dir),
          version: pkg.version,
          description: pkg.description,
        };
      }
    } catch {
      // Ignore errors, keep walking
    }
    dir = path.dirname(dir);
  }

  return { name: path.basename(baseDir ?? path.dirname(entryFile)) };
}
