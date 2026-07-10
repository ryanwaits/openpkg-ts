import type { SpecType, SpecTypeKind } from '@openpkg-ts/spec';
import ts from 'typescript';
import type { SerializerContext } from '../serializers/context';
import {
  ARRAY_PROTOTYPE_METHODS,
  buildSchema,
  NUMBER_PROTOTYPE_METHODS,
  PRIMITIVES,
  STRING_PROTOTYPE_METHODS,
} from '../types/schema-builder';

/** Built-in types that shouldn't be registered */
const BUILTINS = new Set([
  'Array',
  'ArrayBuffer',
  'ArrayBufferLike',
  'ArrayLike',
  'Promise',
  'Map',
  'Set',
  'WeakMap',
  'WeakSet',
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
  'ReadonlyArray',
  'Readonly',
  'Partial',
  'Required',
  'Pick',
  'Omit',
  'Record',
  'Exclude',
  'Extract',
  'NonNullable',
  'Parameters',
  'ReturnType',
  'ConstructorParameters',
  'InstanceType',
  'ThisType',
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
  'SharedArrayBuffer',
  'Atomics',
  'JSON',
  'Math',
  'console',
  'globalThis',
]);

/**
 * Heuristic to detect generic type parameter names.
 * Matches: T, K, V, TType, TValue, TResult, TWire, etc.
 * NOTE: Only match names that are ALWAYS generic params.
 * Names like "Item", "Key", "Value" are commonly used as real types.
 */
function isGenericTypeParameter(name: string): boolean {
  // Single uppercase letter (T, K, V, etc.)
  if (/^[A-Z]$/.test(name)) return true;
  // Starts with T followed by uppercase (TType, TValue, TWire, etc.)
  if (/^T[A-Z]/.test(name)) return true;
  return false;
}

/**
 * Check if a declaration is from an external package (node_modules).
 */
function isExternalType(decl: ts.Declaration): boolean {
  const sourceFile = decl.getSourceFile();
  if (!sourceFile) return false;
  return sourceFile.fileName.includes('node_modules');
}

export class TypeRegistry {
  private types = new Map<string, SpecType>();
  private processing = new Set<string>();

  add(type: SpecType): void {
    this.types.set(type.id, type);
  }

  get(id: string): SpecType | undefined {
    return this.types.get(id);
  }

  has(id: string): boolean {
    return this.types.has(id);
  }

  getAll(): SpecType[] {
    return Array.from(this.types.values());
  }

  /**
   * Register a type from a ts.Type with structured schema.
   * Returns the type ID if registered, undefined if skipped.
   */
  registerType(type: ts.Type, ctx: SerializerContext): string | undefined {
    // Prefer aliasSymbol — for `type Foo = { ... }`, getSymbol() returns __type (anonymous)
    // but aliasSymbol gives us the real name "Foo"
    const symbol = type.aliasSymbol || type.getSymbol();
    if (!symbol) return undefined;

    const name = symbol.getName();

    // Skip primitives, builtins, already registered, or anonymous
    if (PRIMITIVES.has(name)) return undefined;
    if (BUILTINS.has(name)) return undefined;
    if (name.startsWith('__')) return undefined;
    if (symbol.flags & ts.SymbolFlags.EnumMember) return undefined;
    if (symbol.flags & ts.SymbolFlags.TypeParameter) return undefined;
    // Skip methods/functions - they're not types
    if (symbol.flags & ts.SymbolFlags.Method) return undefined;
    if (symbol.flags & ts.SymbolFlags.Function) return undefined;
    if (isGenericTypeParameter(name)) return undefined;
    if (this.has(name)) return name;

    // Prevent infinite recursion
    if (this.processing.has(name)) return name;
    this.processing.add(name);

    try {
      const specType = this.buildSpecType(type, symbol, ctx);
      if (specType) {
        this.add(specType);
        return specType.id;
      }
    } finally {
      this.processing.delete(name);
    }

    return undefined;
  }

  /**
   * Build a SpecType with structured schema using buildSchema.
   */
  private buildSpecType(
    type: ts.Type,
    symbol: ts.Symbol,
    ctx: SerializerContext,
  ): SpecType | undefined {
    const name = symbol.getName();
    const decl = symbol.declarations?.[0];
    const checker = ctx.typeChecker;

    let kind: SpecTypeKind = 'type';
    const external = decl ? isExternalType(decl) : false;

    if (decl) {
      if (ts.isClassDeclaration(decl)) kind = 'class';
      else if (ts.isInterfaceDeclaration(decl)) kind = 'interface';
      else if (ts.isEnumDeclaration(decl)) kind = 'enum';
    }

    if (external) {
      kind = 'external';
    }

    // Build structured schema - but avoid self-referential $ref
    let schema = buildSchema(type, checker, ctx);

    // If schema is just a self-ref, resolve the actual type structure
    if (this.isSelfRef(schema, name)) {
      schema = this.resolveSelRefSchema(type, checker, ctx);
    }

    return {
      id: name,
      name,
      kind,
      schema,
      ...(external ? { external: true } : {}),
    };
  }

  /**
   * Check if schema is a self-referential $ref
   */
  private isSelfRef(schema: unknown, typeName: string): boolean {
    if (typeof schema !== 'object' || schema === null) return false;
    const obj = schema as Record<string, unknown>;
    return obj.$ref === `#/types/${typeName}`;
  }

  /**
   * Resolve a self-referential $ref to the actual type structure.
   * Handles unions (string literal → enum), enums (numeric → enum), and objects.
   */
  private resolveSelRefSchema(
    type: ts.Type,
    checker: ts.TypeChecker,
    ctx: SerializerContext,
  ): Record<string, unknown> {
    // String literal union → { type: "string", enum: [...] }
    if (type.isUnion()) {
      const types = type.types;
      const allStringLiterals = types.every((t) => t.flags & ts.TypeFlags.StringLiteral);
      if (allStringLiterals) {
        return {
          type: 'string',
          enum: types.map((t) => (t as ts.StringLiteralType).value),
        };
      }
      const allNumberLiterals = types.every((t) => t.flags & ts.TypeFlags.NumberLiteral);
      if (allNumberLiterals) {
        return {
          type: 'number',
          enum: types.map((t) => (t as ts.NumberLiteralType).value),
        };
      }
      // Mixed union — build anyOf without alias (to avoid re-triggering $ref)
      return {
        anyOf: types.map((t) => buildSchema(t, checker, ctx)),
      };
    }

    // Enum type — extract members directly from the declaration
    const symbol = type.getSymbol() ?? type.aliasSymbol;
    if (symbol) {
      const decl = symbol.declarations?.find(ts.isEnumDeclaration);
      if (decl) {
        const members: Record<string, unknown>[] = [];
        for (const member of decl.members) {
          const memberSymbol = checker.getSymbolAtLocation(member.name);
          if (memberSymbol) {
            const constantValue = checker.getConstantValue(member);
            if (constantValue !== undefined) {
              members.push({
                name: memberSymbol.getName(),
                value: constantValue,
              });
            }
          }
        }
        if (members.length > 0) {
          return {
            type: typeof members[0].value === 'string' ? 'string' : 'number',
            enum: members.map((m) => m.value),
            'x-enum-members': members,
          };
        }
      }
    }

    // Fallback: build object schema from properties
    return this.buildObjectSchemaFromProperties(type, checker, ctx);
  }

  /**
   * Build object schema from type properties (for interfaces/classes)
   */
  private buildObjectSchemaFromProperties(
    type: ts.Type,
    checker: ts.TypeChecker,
    ctx: SerializerContext,
  ): Record<string, unknown> {
    const properties = type.getProperties();
    const stringIndex = checker
      .getIndexInfosOfType(type)
      .find((i) => i.keyType.flags & ts.TypeFlags.String);
    if (properties.length === 0 && !stringIndex) {
      return { type: checker.typeToString(type) };
    }

    const props: Record<string, unknown> = {};
    const required: string[] = [];
    const limit = ctx.maxProperties;

    if (properties.length > limit && ctx.onTruncation) {
      const typeName = type.getSymbol()?.getName() ?? 'anonymous';
      ctx.onTruncation(typeName, properties.length, limit);
    }

    // Only filter prototype methods when the type is actually array/string/number-like
    const isArrayLike =
      checker.isArrayType(type) ||
      checker.isTupleType(type) ||
      (type.symbol?.getName() === 'Array' &&
        type.symbol
          ?.getDeclarations()?.[0]
          ?.getSourceFile()
          ?.fileName?.includes('/typescript/lib/lib.'));
    const isStringLike = type.flags & ts.TypeFlags.StringLike;
    const isNumberLike = type.flags & ts.TypeFlags.NumberLike;

    for (const prop of properties.slice(0, limit)) {
      const propName = prop.getName();
      if (propName.startsWith('_')) continue;

      // Skip prototype methods only for their matching built-in types
      if (isArrayLike && ARRAY_PROTOTYPE_METHODS.has(propName)) continue;
      if (isStringLike && STRING_PROTOTYPE_METHODS.has(propName)) continue;
      if (isNumberLike && NUMBER_PROTOTYPE_METHODS.has(propName)) continue;

      const propType = checker.getTypeOfSymbol(prop);

      // Register referenced type so it appears in types[]
      this.registerType(propType, ctx);

      props[propName] = buildSchema(propType, checker, ctx);

      if (!(prop.flags & ts.SymbolFlags.Optional)) {
        required.push(propName);
      }
    }

    return {
      type: 'object',
      properties: props,
      ...(required.length > 0 ? { required } : {}),
      ...(stringIndex ? { additionalProperties: buildSchema(stringIndex.type, checker, ctx) } : {}),
    };
  }
}
