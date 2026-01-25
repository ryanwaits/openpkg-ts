import * as fs from 'node:fs';
import * as path from 'node:path';
import type { OpenPkg, SpecExport, SpecMember, SpecSchema, SpecSignature } from '@openpkg-ts/spec';
import { SCHEMA_URL, SCHEMA_VERSION } from '@openpkg-ts/spec';
import ts from 'typescript';
import { resolveExportTarget } from '../ast/resolve';
import {
  extractTypeParametersFromSignature,
  getJSDocForSignature,
  isSymbolDeprecated,
} from '../ast/utils';
import { createProgram } from '../compiler/program';
import { extractStandardSchemasFromProject } from '../schema/standard-schema';
import { serializeClass } from '../serializers/classes';
import { createContext, type SerializerContext } from '../serializers/context';
import { serializeEnum } from '../serializers/enums';
import { serializeFunctionExport } from '../serializers/functions';
import { serializeInterface } from '../serializers/interfaces';
import { serializeTypeAlias } from '../serializers/type-aliases';
import { serializeVariable } from '../serializers/variables';
import type { Diagnostic, ExportTracker, ExtractOptions, ExtractResult } from '../types';
import { extractParameters, registerReferencedTypes } from '../types/parameters';
import { buildSchema } from '../types/schema-builder';
import { normalizeExport, normalizeType } from '../types/schema-normalizer';
import {
  extractExternalExport,
  matchesExternalPattern,
  resolveExternalModule,
} from './external-resolver';
import { mergeRuntimeSchemas } from './schema-merger';
import { clearTypeDefinitionCache, getRegexCache } from './type-cache';
import { buildVerificationSummary, collectForgottenExports } from './verification';

// Re-export for API compatibility
export { clearTypeDefinitionCache } from './type-cache';
export { isExternalType } from './verification';

/** Yield to event loop every N exports to allow spinner animation */
const YIELD_BATCH_SIZE = 5;

/** Compute degraded mode stats from exports */
function computeDegradedStats(exports: SpecExport[]): {
  exportsWithoutDescription: number;
  paramsWithoutDocs: number;
  missingExamples: number;
} {
  let exportsWithoutDescription = 0;
  let paramsWithoutDocs = 0;
  let missingExamples = 0;

  for (const exp of exports) {
    if (!exp.description) exportsWithoutDescription++;
    if (!exp.examples || exp.examples.length === 0) missingExamples++;

    // Count params without docs across all signatures
    const signatures = (
      exp as { signatures?: Array<{ parameters?: Array<{ description?: string }> }> }
    ).signatures;
    if (signatures) {
      for (const sig of signatures) {
        for (const param of sig.parameters ?? []) {
          if (!param.description) paramsWithoutDocs++;
        }
      }
    }
  }

  return { exportsWithoutDescription, paramsWithoutDocs, missingExamples };
}

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
 * @param options.isDtsSource - Set true when extracting from .d.ts (enables degraded mode)
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
      maxExternalTypeDepth,
      resolveExternalTypes,
      includeSchema,
      only,
      ignore,
      onProgress,
      isDtsSource,
      includePrivate,
    } = options;

    const diagnostics: Diagnostic[] = [];
    let exports: SpecExport[] = [];

    // Create program
    const result = createProgram({ entryFile, baseDir, content });
    const { program, sourceFile } = result;

    if (!sourceFile) {
      return {
        spec: createEmptySpec(entryFile, includeSchema, isDtsSource),
        diagnostics: [{ message: `Could not load source file: ${entryFile}`, severity: 'error' }],
      };
    }

    const typeChecker = program.getTypeChecker();

    // Get module symbol and its exports (handles re-exports properly)
    const moduleSymbol = typeChecker.getSymbolAtLocation(sourceFile);
    if (!moduleSymbol) {
      return {
        spec: createEmptySpec(entryFile, includeSchema, isDtsSource),
        diagnostics: [{ message: 'Could not get module symbol', severity: 'warning' }],
      };
    }

    const exportedSymbols = typeChecker.getExportsOfModule(moduleSymbol);

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

    const ctx = createContext(program, sourceFile, {
      maxTypeDepth,
      maxExternalTypeDepth,
      resolveExternalTypes,
      includePrivate,
    });
    ctx.exportedIds = exportedIds;

    // Pre-filter exports to get accurate total for progress reporting
    const filteredSymbols = exportedSymbols.filter((s) =>
      shouldIncludeExport(s.getName(), only, ignore),
    );
    const total = filteredSymbols.length;

    for (let i = 0; i < filteredSymbols.length; i++) {
      const symbol = filteredSymbols[i];
      const exportName = symbol.getName();
      const tracker = exportTracker.get(exportName)!;

      // Report progress and yield to event loop periodically
      onProgress?.(i + 1, total, exportName);
      if (i > 0 && i % YIELD_BATCH_SIZE === 0) {
        await new Promise((r) => setImmediate(r));
      }

      try {
        const { declaration, targetSymbol, isTypeOnly } = resolveExportTarget(symbol, typeChecker);
        if (!declaration) {
          // Check if this is a re-export from an external package
          let externalPackage: string | undefined;

          // Method 1: Check if any declarations point to node_modules
          const allDecls = [...(targetSymbol.declarations ?? []), ...(symbol.declarations ?? [])];
          for (const decl of allDecls) {
            const sf = decl.getSourceFile();
            if (sf?.fileName.includes('node_modules')) {
              const match = sf.fileName.match(/node_modules\/(@[^/]+\/[^/]+|[^/]+)/);
              if (match) {
                externalPackage = match[1];
                break;
              }
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

        const exp = serializeDeclaration(
          declaration,
          symbol,
          targetSymbol,
          exportName,
          ctx,
          isTypeOnly,
        );
        if (exp) {
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

    // Build verification summary from tracker
    const verification = buildVerificationSummary(
      exportedSymbols.length,
      exports.length,
      exportTracker,
    );

    // Get package metadata
    const meta = await getPackageMeta(entryFile, baseDir);
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
        target: options.schemaTarget || 'draft-2020-12',
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
    }

    // Normalize exports and types to JSON Schema 2020-12 format
    // This happens after all extraction (static + runtime schema merging) is complete
    const normalizedExports = exports.map((exp) =>
      normalizeExport(exp, { dialect: 'draft-2020-12' }),
    );
    const normalizedTypes = types.map((t) => normalizeType(t, { dialect: 'draft-2020-12' }));

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

    // Compute degraded mode stats when extracting from .d.ts
    const degradedMode = isDtsSource
      ? { reason: 'dts-source' as const, stats: computeDegradedStats(normalizedExports) }
      : undefined;

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
      ...(degradedMode ? { degradedMode } : {}),
    };
  } finally {
    // Clear caches after extraction to prevent memory leaks
    clearTypeDefinitionCache();
  }
}

function serializeDeclaration(
  declaration: ts.Declaration,
  exportSymbol: ts.Symbol,
  _targetSymbol: ts.Symbol,
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
  } else if (ts.isNamespaceExport(declaration) || ts.isModuleDeclaration(declaration)) {
    try {
      result = serializeNamespaceExport(exportSymbol, exportName, ctx);
    } catch {
      // Fallback for namespace exports with parent chain issues
      result = {
        id: exportName,
        name: exportName,
        kind: 'namespace',
        tags: [],
        members: [],
        examples: [],
      };
    }
  } else if (ts.isNamespaceImport(declaration)) {
    // Handle `import * as foo` re-exported as `export { foo }`
    try {
      result = serializeNamespaceExport(exportSymbol, exportName, ctx);
    } catch {
      // Fallback for namespace imports with parent chain issues
      result = {
        id: exportName,
        name: exportName,
        kind: 'namespace',
        tags: [],
        members: [],
        examples: [],
      };
    }
  } else if (ts.isSourceFile(declaration)) {
    try {
      result = serializeNamespaceExport(exportSymbol, exportName, ctx);
    } catch {
      // Fallback for source file exports with parent chain issues
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
    // Add typeOnly flag for type-only re-exports
    if (isTypeOnly) {
      result = {
        ...result,
        flags: { ...(result.flags ?? {}), typeOnly: true },
      };
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
  const deprecated = isSymbolDeprecated(targetSymbol);

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
    signatures = callSignatures.map((sig, index) => {
      const params = extractParameters(sig, ctx);
      const returnType = checker.getReturnTypeOfSignature(sig);
      registerReferencedTypes(returnType, ctx);
      const returnSchema = buildSchema(returnType, ctx.typeChecker, ctx);

      // Get per-overload JSDoc
      const sigDoc = getJSDocForSignature(sig, checker);
      const sigTypeParams = extractTypeParametersFromSignature(sig, ctx.typeChecker);

      return {
        parameters: params,
        returns: { schema: returnSchema },
        ...(sigDoc.description ? { description: sigDoc.description } : {}),
        ...(sigDoc.tags.length > 0 ? { tags: sigDoc.tags } : {}),
        ...(sigDoc.examples.length > 0 ? { examples: sigDoc.examples } : {}),
        ...(sigTypeParams ? { typeParameters: sigTypeParams } : {}),
        ...(callSignatures.length > 1 ? { overloadIndex: index } : {}),
      };
    });
  }

  // Build schema for non-function members
  let schema: SpecSchema | undefined;
  if (kind !== 'function') {
    registerReferencedTypes(type, ctx);
    schema = buildSchema(type, ctx.typeChecker, ctx);
  }

  return {
    name: memberName,
    kind,
    ...(description ? { description } : {}),
    ...(signatures ? { signatures } : {}),
    ...(schema ? { schema } : {}),
    ...(deprecated ? { flags: { deprecated: true } } : {}),
  };
}

function getJSDocFromExportSymbol(symbol: ts.Symbol): {
  description?: string;
  tags: Array<{ name: string; text: string }>;
  examples: string[];
} {
  const tags: Array<{ name: string; text: string }> = [];
  const examples: string[] = [];

  const decl = symbol.declarations?.[0];
  if (decl) {
    const exportDecl = ts.isNamespaceExport(decl) ? decl.parent : decl;
    if (exportDecl && ts.isExportDeclaration(exportDecl)) {
      const jsDocs = ts.getJSDocCommentsAndTags(exportDecl);
      for (const doc of jsDocs) {
        if (ts.isJSDoc(doc) && doc.comment) {
          const commentText =
            typeof doc.comment === 'string'
              ? doc.comment
              : doc.comment.map((c) => ('text' in c ? c.text : '')).join('');
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

function extractJSDocTags(doc: ts.JSDoc): Array<{ name: string; text: string }> {
  const tags: Array<{ name: string; text: string }> = [];
  for (const tag of doc.tags ?? []) {
    if (tag.tagName.text !== 'example') {
      const text =
        typeof tag.comment === 'string'
          ? tag.comment
          : (tag.comment?.map((c) => ('text' in c ? c.text : '')).join('') ?? '');
      tags.push({ name: tag.tagName.text, text });
    }
  }
  return tags;
}

function extractExamples(doc: ts.JSDoc): string[] {
  const examples: string[] = [];
  for (const tag of doc.tags ?? []) {
    if (tag.tagName.text === 'example') {
      const text =
        typeof tag.comment === 'string'
          ? tag.comment
          : (tag.comment?.map((c) => ('text' in c ? c.text : '')).join('') ?? '');
      if (text) examples.push(text);
    }
  }
  return examples;
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

function createEmptySpec(
  entryFile: string,
  includeSchema?: boolean,
  isDtsSource?: boolean,
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
      ...(isDtsSource && {
        limitations: ['No JSDoc descriptions', 'No @example tags', 'No @param descriptions'],
      }),
    },
  };
}

async function getPackageMeta(
  entryFile: string,
  baseDir?: string,
): Promise<{ name: string; version?: string; description?: string }> {
  const searchDir = baseDir ?? path.dirname(entryFile);
  const pkgPath = path.join(searchDir, 'package.json');

  try {
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      return {
        name: pkg.name ?? path.basename(searchDir),
        version: pkg.version,
        description: pkg.description,
      };
    }
  } catch {
    // Ignore errors
  }

  return { name: path.basename(searchDir) };
}
