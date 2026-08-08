/**
 * Schema Library Adapter Registry
 *
 * Manages adapters for extracting output types from schema validation
 * libraries (Zod, Valibot, TypeBox, ArkType) using TypeScript's compiler API.
 */
import ts from 'typescript';

/**
 * A schema adapter can detect and extract output types from a specific
 * schema validation library.
 */
export interface SchemaAdapter {
  /** Unique identifier for this adapter */
  readonly id: string;

  /** npm package name(s) this adapter handles */
  readonly packages: readonly string[];

  /**
   * Check if a type matches this adapter's schema library.
   * Should be fast - called for every export.
   */
  matches(type: ts.Type, checker: ts.TypeChecker): boolean;

  /**
   * Extract the output type from a schema type.
   * Returns null if extraction fails.
   */
  extractOutputType(type: ts.Type, checker: ts.TypeChecker): ts.Type | null;

  /**
   * Extract the input type from a schema type (optional).
   * Useful for transforms where input differs from output.
   */
  extractInputType?(type: ts.Type, checker: ts.TypeChecker): ts.Type | null;
}

/**
 * Result of schema type extraction
 */
export interface SchemaExtractionResult {
  /** The adapter that matched */
  adapter: SchemaAdapter;

  /** The extracted output type */
  outputType: ts.Type;

  /** The extracted input type (if different from output) */
  inputType?: ts.Type;
}

/**
 * Utility: Check if type is an object type reference (has type arguments)
 */
export function isTypeReference(type: ts.Type): type is ts.TypeReference {
  return !!(
    type.flags & ts.TypeFlags.Object &&
    (type as ts.ObjectType).objectFlags &&
    (type as ts.ObjectType).objectFlags & ts.ObjectFlags.Reference
  );
}

/**
 * Utility: Remove undefined/null from a union type
 */
export function getNonNullableType(type: ts.Type): ts.Type {
  if (type.isUnion()) {
    const nonNullable = type.types.filter(
      (t) => !(t.flags & ts.TypeFlags.Undefined) && !(t.flags & ts.TypeFlags.Null),
    );
    if (nonNullable.length === 1) {
      return nonNullable[0];
    }
  }
  return type;
}

const adapters: SchemaAdapter[] = [];

export function registerAdapter(adapter: SchemaAdapter): void {
  adapters.push(adapter);
}

export function findAdapter(type: ts.Type, checker: ts.TypeChecker): SchemaAdapter | undefined {
  return adapters.find((a) => a.matches(type, checker));
}

export function isSchemaType(type: ts.Type, checker: ts.TypeChecker): boolean {
  return adapters.some((a) => a.matches(type, checker));
}

export function extractSchemaType(
  type: ts.Type,
  checker: ts.TypeChecker,
): SchemaExtractionResult | null {
  const adapter = findAdapter(type, checker);
  if (!adapter) return null;

  const outputType = adapter.extractOutputType(type, checker);
  if (!outputType) return null;

  const inputType = adapter.extractInputType?.(type, checker) ?? undefined;

  return {
    adapter,
    outputType,
    inputType,
  };
}
