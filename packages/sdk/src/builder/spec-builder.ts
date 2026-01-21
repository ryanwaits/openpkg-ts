import * as fs from 'node:fs';
import * as path from 'node:path';
import type {
  OpenPkg,
  SpecExport,
  SpecMember,
  SpecSchema,
  SpecSignature,
  SpecType,
} from '@openpkg-ts/spec';
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
import type {
  Diagnostic,
  ExportTracker,
  ExportVerification,
  ExtractOptions,
  ExtractResult,
  ForgottenExport,
  TypeReference,
} from '../types';
import { extractParameters, registerReferencedTypes } from '../types/parameters';
import { buildSchema } from '../types/schema-builder';
import { normalizeExport, normalizeType } from '../types/schema-normalizer';
import { mergeRuntimeSchemas } from './schema-merger';

/** Cache for findTypeDefinition results to avoid redundant AST walks */
let typeDefinitionCache: Map<string, string | undefined> | null = null;

function getTypeDefinitionCache(): Map<string, string | undefined> {
  if (!typeDefinitionCache) {
    typeDefinitionCache = new Map();
  }
  return typeDefinitionCache;
}

/** Cache for hasInternalTag results to avoid redundant resolveName calls */
let internalTagCache: Map<string, boolean> | null = null;

function getInternalTagCache(): Map<string, boolean> {
  if (!internalTagCache) {
    internalTagCache = new Map();
  }
  return internalTagCache;
}

/** Clear caches at start of each extraction */
export function clearTypeDefinitionCache(): void {
  typeDefinitionCache = null;
  internalTagCache = null;
}

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

/** Build verification summary from export tracker data */
function buildVerificationSummary(
  discoveredCount: number,
  extractedCount: number,
  tracker: Map<string, ExportTracker>,
): ExportVerification {
  const skippedDetails: ExportVerification['details']['skipped'] = [];
  const failedDetails: ExportVerification['details']['failed'] = [];

  for (const entry of tracker.values()) {
    if (entry.status === 'skipped' && entry.skipReason) {
      skippedDetails.push({ name: entry.name, reason: entry.skipReason });
    } else if (entry.status === 'failed' && entry.error) {
      failedDetails.push({ name: entry.name, error: entry.error });
    }
  }

  const skipped = skippedDetails.length;
  const failed = failedDetails.length;
  const delta = discoveredCount - extractedCount - skipped;

  return {
    discovered: discoveredCount,
    extracted: extractedCount,
    skipped,
    failed,
    delta,
    details: {
      skipped: skippedDetails,
      failed: failedDetails,
    },
  };
}

/** Built-in types that shouldn't be tracked as dangling refs */
const BUILTIN_TYPES = new Set([
  'Array',
  'ArrayBuffer',
  'ArrayBufferLike',
  'ArrayLike',
  'Promise',
  'Map',
  'Set',
  'WeakMap',
  'WeakSet',
  'Record',
  'Partial',
  'Required',
  'Pick',
  'Omit',
  'Exclude',
  'Extract',
  'NonNullable',
  'Parameters',
  'ReturnType',
  'Readonly',
  'ReadonlyArray',
  'Awaited',
  'PromiseLike',
  'Iterable',
  'Iterator',
  'IterableIterator',
  'Generator',
  'AsyncGenerator',
  'AsyncIterable',
  'AsyncIterator',
  'AsyncIterableIterator',
  'Date',
  'RegExp',
  'Error',
  'Function',
  'Object',
  'String',
  'Number',
  'Boolean',
  'Symbol',
  'BigInt',
  'Uint8Array',
  'Int8Array',
  'Uint16Array',
  'Int16Array',
  'Uint32Array',
  'Int32Array',
  'Float32Array',
  'Float64Array',
  'BigInt64Array',
  'BigUint64Array',
  'DataView',
  'SharedArrayBuffer',
  'ConstructorParameters',
  'InstanceType',
  'ThisType',
]);

/**
 * Match export name against pattern (supports * wildcards)
 */
function matchesPattern(name: string, pattern: string): boolean {
  if (!pattern.includes('*')) return name === pattern;
  const regex = new RegExp(`^${pattern.replace(/\*/g, '.*')}$`);
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
 * Check if a type name should be skipped (anonymous, generic param, etc.)
 */
function shouldSkipDanglingRef(name: string): boolean {
  // Anonymous types
  if (name.startsWith('__')) return true;
  // Single uppercase letter (generic params)
  if (/^[A-Z]$/.test(name)) return true;
  // Starts with T followed by uppercase (TType, TValue, TWire, etc.)
  if (/^T[A-Z]/.test(name)) return true;
  // Common generic names
  if (['Key', 'Value', 'Item', 'Element'].includes(name)) return true;
  return false;
}

export async function extract(options: ExtractOptions): Promise<ExtractResult> {
  // Clear caches at start of each extraction
  clearTypeDefinitionCache();

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
        const allDecls = [
          ...(targetSymbol.declarations ?? []),
          ...(symbol.declarations ?? []),
        ];
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
}

/** Location context for type reference tracking */
type RefLocation = TypeReference['location'];

/** Mutable state for tracking reference context during traversal */
interface RefTraversalState {
  exportName: string;
  location: RefLocation;
  path: string[];
}

/**
 * Collect all $ref values with context (which export, location type, path)
 * Uses mutable state with push/pop to avoid allocation overhead
 */
function collectAllRefsWithContext(
  obj: unknown,
  refs: Map<string, TypeReference[]>,
  state: RefTraversalState,
): void {
  if (obj === null || obj === undefined) return;

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      state.path.push(`[${i}]`);
      collectAllRefsWithContext(obj[i], refs, state);
      state.path.pop();
    }
    return;
  }

  if (typeof obj === 'object') {
    const record = obj as Record<string, unknown>;
    if (typeof record.$ref === 'string' && record.$ref.startsWith('#/types/')) {
      const typeName = record.$ref.slice('#/types/'.length);
      const existing = refs.get(typeName) ?? [];
      existing.push({
        typeName,
        exportName: state.exportName,
        location: state.location,
        path: state.path.length > 0 ? state.path.join('.') : undefined,
      });
      refs.set(typeName, existing);
    }

    const prevLocation = state.location;
    for (const [key, value] of Object.entries(record)) {
      // Infer location from property name
      if (key === 'returnType' || key === 'returns') state.location = 'return';
      else if (key === 'parameters' || key === 'params') state.location = 'parameter';
      else if (key === 'properties' || key === 'members') state.location = 'property';
      else if (key === 'extends' || key === 'implements') state.location = 'extends';
      else if (key === 'typeParameters' || key === 'typeParams') state.location = 'type-parameter';

      state.path.push(key);
      collectAllRefsWithContext(value, refs, state);
      state.path.pop();
      state.location = prevLocation;
    }
  }
}

/**
 * Find where a type is defined in the source files
 */
function findTypeDefinition(
  typeName: string,
  program: ts.Program,
  sourceFile: ts.SourceFile,
): string | undefined {
  const cache = getTypeDefinitionCache();

  // Check cache first (includes both found and not-found results)
  if (cache.has(typeName)) {
    return cache.get(typeName);
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
    cache.set(typeName, entryResult);
    return entryResult;
  }

  // Check all source files in program
  for (const sf of program.getSourceFiles()) {
    if (sf.isDeclarationFile && !sf.fileName.includes('node_modules')) {
      const result = findInNode(sf);
      if (result) {
        cache.set(typeName, result);
        return result;
      }
    }
  }

  // Try to find via type checker symbol lookup
  const symbol = checker.resolveName(typeName, sourceFile, ts.SymbolFlags.Type, false);
  if (symbol?.declarations?.[0]) {
    const result = symbol.declarations[0].getSourceFile().fileName;
    cache.set(typeName, result);
    return result;
  }

  // Cache not-found result too
  cache.set(typeName, undefined);
  return undefined;
}

/**
 * Determine if a type is external (from node_modules/dependencies or outside project)
 * @internal Exported for testing
 */
export function isExternalType(definedIn: string | undefined, baseDir: string): boolean {
  if (!definedIn) return true;
  // External if in node_modules
  if (definedIn.includes('node_modules')) return true;
  // External if outside project directory (e.g., linked packages)
  const normalizedDefined = path.resolve(definedIn);
  const normalizedBase = path.resolve(baseDir);
  return !normalizedDefined.startsWith(normalizedBase);
}

/**
 * Check if a type has @internal JSDoc tag
 */
function hasInternalTag(typeName: string, program: ts.Program, sourceFile: ts.SourceFile): boolean {
  const cache = getInternalTagCache();
  const cached = cache.get(typeName);
  if (cached !== undefined) {
    return cached;
  }

  const checker = program.getTypeChecker();
  const symbol = checker.resolveName(typeName, sourceFile, ts.SymbolFlags.Type, false);

  if (!symbol) {
    cache.set(typeName, false);
    return false;
  }

  const jsTags = symbol.getJsDocTags();
  const isInternal = jsTags.some((tag) => tag.name === 'internal');
  cache.set(typeName, isInternal);
  return isInternal;
}

/**
 * Find all dangling $ref references with enhanced context
 */
function collectForgottenExports(
  exports: SpecExport[],
  types: SpecType[],
  program: ts.Program,
  sourceFile: ts.SourceFile,
  exportedIds: Set<string>,
  baseDir: string,
  definedTypes: Set<string>,
): ForgottenExport[] {
  const referencedTypes = new Map<string, TypeReference[]>();

  // Collect refs from exports with context
  for (const exp of exports) {
    collectAllRefsWithContext(exp, referencedTypes, {
      exportName: exp.id || exp.name,
      location: 'property',
      path: [],
    });
  }

  // Collect refs from types themselves (for nested refs)
  for (const type of types) {
    collectAllRefsWithContext(type, referencedTypes, {
      exportName: type.id,
      location: 'property',
      path: [],
    });
  }

  const forgottenExports: ForgottenExport[] = [];

  for (const [typeName, references] of referencedTypes) {
    // Skip if already defined, builtin, or should be skipped
    if (definedTypes.has(typeName)) continue;
    if (BUILTIN_TYPES.has(typeName)) continue;
    if (shouldSkipDanglingRef(typeName)) continue;
    // Skip types marked @internal - intentionally not exported
    if (hasInternalTag(typeName, program, sourceFile)) continue;
    // Skip re-exported types (already in public API)
    if (exportedIds.has(typeName)) continue;

    const definedIn = findTypeDefinition(typeName, program, sourceFile);
    const isExternal = isExternalType(definedIn, baseDir);

    forgottenExports.push({
      name: typeName,
      definedIn,
      referencedBy: references,
      isExternal,
      fix: isExternal ? undefined : `export { ${typeName} } from '${definedIn ?? './types'}'`,
    });
  }

  return forgottenExports;
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
      result = serializeVariable(declaration, varStatement, ctx);
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
    name: entry.name,
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
