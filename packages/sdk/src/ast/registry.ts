import type { SpecType, SpecTypeKind, SpecTypeParameter } from '@openpkg-ts/spec';
import ts from 'typescript';
import type { SerializerContext } from '../serializers/context';
import {
  ARRAY_PROTOTYPE_METHODS,
  buildFunctionSchema,
  buildSchema,
  decoratePropertySchema,
  getTypeOrigin,
  NUMBER_PROTOTYPE_METHODS,
  PRIMITIVES,
  renderTypeText,
  STRING_PROTOTYPE_METHODS,
  shouldEmitAliasTypeText,
  stripUndefinedFromType,
  withDeprecated,
  withDescription,
} from '../types/schema-builder';
import { extractTypeParameters, isSymbolDeprecated } from './utils';

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

    // Ambient/external types outside the expansion scope (lib.dom, bun-types,
    // non-workspace node_modules) get an opaque stub: the $ref stays
    // resolvable, but the spec doesn't inline a foreign package's full member
    // surface (environment-dependent, hundreds of lines per type).
    if (ctx.shouldExpandExternal && !ctx.shouldExpandExternal(symbol)) {
      // Record the DECLARING package so consumers know exactly what name to
      // add to followExternal — the import specifier in user code may differ
      // (e.g. imported from 'ai' but declared in '@ai-sdk/provider').
      const origin = getTypeOrigin(type, ctx.typeChecker);
      const schema: Record<string, unknown> = {
        'x-ts-type': renderTypeText(type, ctx.typeChecker),
      };
      if (origin) schema['x-ts-package'] = origin;
      this.add({
        id: name,
        name,
        kind: 'external',
        external: true,
        schema: schema as SpecType['schema'],
      } as SpecType);
      return name;
    }

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

    // Enums always carry member names, not just values — a bare value list
    // loses the `Compression.GZipJS` identity consumers address members by.
    if (kind === 'enum') {
      const enumSchema = this.buildEnumSchema(symbol, checker);
      if (enumSchema) {
        schema = enumSchema;
      }
    }

    // Alias-level x-ts-type: array/instantiation/union/intersection/function
    // aliases have no renderable text in their structural schema — attach the
    // checker-rendered RHS ("Item[]", "Generic<A, B>") for display consumers.
    if (
      kind === 'type' &&
      decl &&
      ts.isTypeAliasDeclaration(decl) &&
      shouldEmitAliasTypeText(decl.type) &&
      typeof schema === 'object' &&
      schema !== null &&
      !('x-ts-type' in schema)
    ) {
      const text = renderTypeText(type, checker, decl, ts.TypeFormatFlags.InTypeAlias);
      if (!PRIMITIVES.has(text) && text !== name) {
        (schema as Record<string, unknown>)['x-ts-type'] = text;
      }
    }

    // Generic types keep their type parameters — consumers can't meaningfully
    // flatten a generic alias without knowing it takes arguments.
    let typeParameters: SpecTypeParameter[] | undefined;
    if (
      decl &&
      (ts.isTypeAliasDeclaration(decl) ||
        ts.isInterfaceDeclaration(decl) ||
        ts.isClassDeclaration(decl))
    ) {
      typeParameters = extractTypeParameters(decl, checker);
    }

    return {
      id: name,
      name,
      kind,
      ...(typeParameters && typeParameters.length > 0 ? { typeParameters } : {}),
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
      const enumSchema = this.buildEnumSchema(symbol, checker);
      if (enumSchema) {
        return enumSchema;
      }
    }

    // Function aliases (`type Fn = (x) => y`) — emit signatures, not a stub
    const callSignatures = type.getCallSignatures();
    if (callSignatures.length > 0 && type.getProperties().length === 0) {
      return buildFunctionSchema(callSignatures, checker, ctx) as Record<string, unknown>;
    }

    // Array/tuple aliases (`type L = Item[]`) — getProperties() only yields
    // prototype methods, which the object fallback filters to an empty shape.
    // Build the real array structure instead.
    if (checker.isTupleType(type)) {
      const elementTypes = checker.getTypeArguments(type as ts.TypeReference) ?? [];
      return {
        type: 'array',
        prefixItems: elementTypes.map((t) => buildSchema(t, checker, ctx)),
        minItems: elementTypes.length,
        maxItems: elementTypes.length,
      };
    }
    if (checker.isArrayType(type)) {
      const elementType = checker.getTypeArguments(type as ts.TypeReference)?.[0];
      return elementType
        ? { type: 'array', items: buildSchema(elementType, checker, ctx) }
        : { type: 'array' };
    }

    // Deferred conditionals (Cond<T> = T extends string ? ...) have no real
    // object shape — their apparent properties are the String/Number prototype.
    // Emit the verbatim type text instead of flattening ~50 lib methods.
    if (type.flags & ts.TypeFlags.Conditional) {
      return { 'x-ts-type': renderTypeText(type, checker) };
    }

    // Types that resolve to a primitive (e.g. a generic indexed-access
    // `Extract<…>["name"]` whose base constraint is `string`) expose the
    // primitive's prototype as apparent properties — flattening them yields
    // ~50 bogus members (charAt, toFixed, …). Emit the primitive + text.
    const constraint = checker.getBaseConstraintOfType(type);
    const primitive =
      constraint && constraint.flags & ts.TypeFlags.StringLike
        ? 'string'
        : constraint && constraint.flags & ts.TypeFlags.NumberLike
          ? 'number'
          : constraint && constraint.flags & ts.TypeFlags.BooleanLike
            ? 'boolean'
            : undefined;
    if (primitive) {
      return { type: primitive, 'x-ts-type': renderTypeText(type, checker) };
    }

    // Fallback: build object schema from properties
    return this.buildObjectSchemaFromProperties(type, checker, ctx);
  }

  /**
   * Build an enum schema with member names from the enum declaration.
   * Returns undefined when the symbol has no enum declaration or no
   * constant-valued members.
   */
  private buildEnumSchema(
    symbol: ts.Symbol,
    checker: ts.TypeChecker,
  ): Record<string, unknown> | undefined {
    const decl = symbol.declarations?.find(ts.isEnumDeclaration);
    if (!decl) return undefined;

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
    if (members.length === 0) return undefined;
    return {
      type: typeof members[0].value === 'string' ? 'string' : 'number',
      enum: members.map((m) => m.value),
      'x-enum-members': members,
    };
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
    const indexInfos = checker.getIndexInfosOfType(type);
    const stringIndex = indexInfos.find((i) => i.keyType.flags & ts.TypeFlags.String);
    const numberIndex = indexInfos.find((i) => i.keyType.flags & ts.TypeFlags.Number);
    if (properties.length === 0 && !stringIndex && !numberIndex) {
      return { type: checker.typeToString(type) };
    }

    const props: Record<string, unknown> = {};
    const required: string[] = [];
    const limit = ctx.maxProperties;

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

    // Filter BEFORE slicing — otherwise skipped names consume limit budget and
    // real members past the raw cutoff are silently dropped (intersection types
    // append their object-literal branch members last, so those go first).
    const included = properties.filter((prop) => {
      const propName = prop.getName();
      // Symbol-keyed members (checker-internal `__@iterator@…` names) aren't serializable
      if (propName.startsWith('__@')) return false;
      // Prototype methods only for their matching built-in types
      if (isArrayLike && ARRAY_PROTOTYPE_METHODS.has(propName)) return false;
      if (isStringLike && STRING_PROTOTYPE_METHODS.has(propName)) return false;
      if (isNumberLike && NUMBER_PROTOTYPE_METHODS.has(propName)) return false;
      return true;
    });

    if (included.length > limit && ctx.onTruncation) {
      const typeName = type.getSymbol()?.getName() ?? 'anonymous';
      ctx.onTruncation(typeName, included.length, limit);
    }

    for (const prop of included.slice(0, limit)) {
      const propName = prop.getName();
      const rawPropType = checker.getTypeOfSymbol(prop);
      // Mirror buildObjectSchema: optional props express optionality via
      // required omission — strip undefined so null isn't admitted
      const propType =
        prop.flags & ts.SymbolFlags.Optional
          ? stripUndefinedFromType(rawPropType, checker)
          : rawPropType;

      // Register referenced type so it appears in types[]
      this.registerType(propType, ctx);

      let propSchema = buildSchema(propType, checker, ctx);

      // Mirror buildObjectSchema: flattened registry schemas carry per-property
      // doc comments and deprecation for consumers reading only the schema layer.
      const docComment = prop.getDocumentationComment(checker);
      if (docComment.length > 0) {
        const description = docComment.map((c) => c.text).join('\n');
        if (description.trim()) {
          propSchema = withDescription(propSchema, description);
        }
      }
      const { deprecated, reason } = isSymbolDeprecated(prop);
      if (deprecated) {
        propSchema = withDeprecated(propSchema, reason);
      }

      propSchema = decoratePropertySchema(propSchema, prop, propType, checker);

      props[propName] = propSchema;

      if (!(prop.flags & ts.SymbolFlags.Optional)) {
        required.push(propName);
      }
    }

    return {
      type: 'object',
      properties: props,
      ...(required.length > 0 ? { required } : {}),
      ...(stringIndex ? { additionalProperties: buildSchema(stringIndex.type, checker, ctx) } : {}),
      ...(numberIndex
        ? {
            patternProperties: { '^\\d+$': buildSchema(numberIndex.type, checker, ctx) },
            'x-ts-index-key': 'number',
          }
        : {}),
    };
  }
}
