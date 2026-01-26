/**
 * Export verification and forgotten export detection utilities.
 */

import * as path from 'node:path';
import type { SpecExport, SpecType } from '@openpkg-ts/spec';
import type ts from 'typescript';
import type { ExportTracker, ExportVerification, ForgottenExport, TypeReference } from '../types';
import { findTypeDefinition, hasInternalTag } from './type-cache';

/** Built-in types that shouldn't be tracked as dangling refs */
export const BUILTIN_TYPES: Set<string> = new Set([
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

/** Build verification summary from export tracker data */
export function buildVerificationSummary(
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
 * Check if a type name should be skipped (anonymous, generic param, etc.)
 */
export function shouldSkipDanglingRef(name: string): boolean {
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
export function collectAllRefsWithContext(
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
 * Find all dangling $ref references with enhanced context
 */
export function collectForgottenExports(
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
