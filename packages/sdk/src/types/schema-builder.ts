import type { SpecSchema, SpecSignature } from '@openpkg-ts/spec';
import ts from 'typescript';
import { resolveTypeId, typeRefId } from '../ast/type-identity';
import { isSymbolDeprecated } from '../ast/utils';
import { BUILTIN_TYPE_SCHEMAS, type BuiltinSchema } from '../schema/builtins';
import type { SerializerContext } from '../serializers/context';

export { BUILTIN_TYPE_SCHEMAS } from '../schema/builtins';

/** Escape regex metacharacters in a literal template span. */
function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Lower a template literal type to an anchored regex pattern.
 * Slot approximations: number → -?\d+(\.\d+)?, bigint → -?\d+,
 * boolean → (true|false), anything else → .*
 */
function buildTemplatePattern(type: ts.TemplateLiteralType): string {
  const slotPattern = (slot: ts.Type): string => {
    if (slot.flags & ts.TypeFlags.NumberLike) return '-?\\d+(?:\\.\\d+)?';
    if (slot.flags & ts.TypeFlags.BigIntLike) return '-?\\d+';
    if (slot.flags & ts.TypeFlags.BooleanLike) return '(?:true|false)';
    return '.*';
  };
  let pattern = `^${escapeRegex(type.texts[0] ?? '')}`;
  type.types.forEach((slot, i) => {
    pattern += slotPattern(slot) + escapeRegex(type.texts[i + 1] ?? '');
  });
  return `${pattern}$`;
}

/** `#/types/…` target id for a named type — collision-scoped when a context is
 * available (matches how the registry keys the type), bare name otherwise. */
function namedRefId(type: ts.Type, name: string, ctx?: SerializerContext): string {
  if (!ctx) return name;
  return typeRefId(type, ctx) || name;
}

/** Structural schema for a built-in lib type reference (never $ref — lib types
 * are not registered in types[], so a ref would dangle). */
function builtinSchema(name: string): BuiltinSchema {
  const schema: BuiltinSchema = { ...(BUILTIN_TYPE_SCHEMAS[name] ?? { type: 'object' }) };
  setSchemaExtension(schema, 'x-ts-type', name);
  return schema;
}

/** Attach a JSON Schema extension field (x-ts-*) to a schema. */
function setSchemaExtension(schema: SpecSchema, key: string, value: unknown): void {
  (schema as Record<string, unknown>)[key] = value;
}

/**
 * Remove `import("<abs path>").` qualifiers from checker-rendered type text.
 * Machine-specific paths must never appear in a published spec.
 */
export function scrubImportQualifiers(text: string): string {
  return text.replace(/import\((?:"[^"]*"|'[^']*')\)\./g, '');
}

/**
 * Render the developer-facing type text at its owning declaration.
 * NoTruncation keeps long unions intact; import() qualifiers are scrubbed.
 */
export function renderTypeText(
  type: ts.Type,
  checker: ts.TypeChecker,
  enclosing?: ts.Node,
  extraFlags: ts.TypeFormatFlags = 0,
): string {
  return scrubImportQualifiers(
    checker.typeToString(type, enclosing, ts.TypeFormatFlags.NoTruncation | extraFlags),
  );
}

/**
 * The type exactly as the author WROTE it — the annotation node's source text.
 * `x-ts-type` carries the resolved truth (`Omit<T, K>` expanded to its mapped
 * type, `InitiatorType` expanded to its union); this recovers the declared form
 * a docs reader recognizes.
 *
 * Restricted to NAMED references and unions — the shapes where the author wrote
 * a name that resolves to something else. Object literals, mapped, and
 * conditional bodies are excluded: they differ from their resolved text only by
 * formatting (a trailing `;`, `readonly T[]` vs `ReadonlyArray<T>`) or would
 * drag source comments into the spec, both of which are noise, not signal.
 */
export function writtenTypeText(typeNode: ts.TypeNode | undefined): string | undefined {
  if (!typeNode) return undefined;
  if (!ts.isTypeReferenceNode(typeNode) && !ts.isUnionTypeNode(typeNode)) return undefined;
  try {
    const text = scrubImportQualifiers(
      typeNode
        .getText()
        .replace(/\s+/g, ' ')
        .replace(/^\|\s*/, '')
        .trim(),
    );
    return text.length > 0 ? text : undefined;
  } catch {
    return undefined;
  }
}

/** The annotation TypeNode on a declaration (property, alias, parameter), if any. */
export function declaredTypeNode(decl: ts.Declaration | undefined): ts.TypeNode | undefined {
  const withType = decl as { type?: ts.TypeNode } | undefined;
  return withType?.type;
}

/**
 * Strip `undefined` from a union type when optionality is already expressed
 * elsewhere (`required: false`, `flags.optional`). Used for both schema shape
 * and x-ts-type text so neither re-encodes optionality as `| undefined`.
 */
export function stripUndefinedFromType(type: ts.Type, checker: ts.TypeChecker): ts.Type {
  if (!type.isUnion()) return type;

  const nonUndefinedTypes = type.types.filter((t) => !(t.flags & ts.TypeFlags.Undefined));

  if (nonUndefinedTypes.length === 0) return type;
  if (nonUndefinedTypes.length === 1) return nonUndefinedTypes[0];

  // getUnionType is an internal TypeScript API absent from public typings but
  // verified present at runtime in TS 5.x; revisit on TypeScript upgrades.
  type CheckerWithUnion = ts.TypeChecker & {
    getUnionType(types: readonly ts.Type[]): ts.Type;
  };
  return (checker as CheckerWithUnion).getUnionType(nonUndefinedTypes);
}

/** Declaration-modifier readonly check — matches the member-layer flags.readonly source. */
export function isReadonlyPropertySymbol(prop: ts.Symbol): boolean {
  const decls = prop.getDeclarations() ?? [];
  return decls.some((d) => (ts.getCombinedModifierFlags(d) & ts.ModifierFlags.Readonly) !== 0);
}

/**
 * Decorate a property schema with TS-fidelity metadata:
 * - `x-ts-type`: checker-rendered text at the owning declaration. Emitted
 *   unless trivially derivable — a bare primitive keyword, or a $ref whose
 *   target name equals the text. Optional props render without `| undefined`.
 * - `readOnly`: JSON Schema readonly marker from the declaration modifier.
 * - `x-ts-method`: declaration form marker for method-syntax members
 *   (SymbolFlags.Method survives on true methods, is stripped by mapping).
 */
export function decoratePropertySchema(
  schema: SpecSchema,
  prop: ts.Symbol,
  propType: ts.Type,
  checker: ts.TypeChecker,
): SpecSchema {
  if (typeof schema !== 'object' || schema === null || Array.isArray(schema)) return schema;

  const decl = prop.valueDeclaration ?? prop.getDeclarations()?.[0];
  const optional = !!(prop.flags & ts.SymbolFlags.Optional);
  const textType = optional ? stripUndefinedFromType(propType, checker) : propType;
  const text = renderTypeText(textType, checker, decl);

  const obj = schema as Record<string, unknown>;
  const refTarget =
    typeof obj.$ref === 'string'
      ? obj.$ref
      : Array.isArray(obj.allOf) && obj.allOf.length === 1 && isPureRefSchema(obj.allOf[0])
        ? (obj.allOf[0] as { $ref: string }).$ref
        : undefined;
  const derivable = PRIMITIVES.has(text) || refTarget === `#/types/${text}`;

  let result: Record<string, unknown> = obj;
  if (!derivable && !('x-ts-type' in obj)) {
    result = { ...result, 'x-ts-type': text };
    // When the author wrote a named type whose resolved rendering differs
    // (`InitiatorType` → a 21-literal union), also carry the declared form so a
    // docs consumer can show what was written instead of the expansion.
    const declared = writtenTypeText(declaredTypeNode(decl));
    if (declared && declared !== text && !PRIMITIVES.has(declared) && !('x-ts-declared' in obj)) {
      result = { ...result, 'x-ts-declared': declared };
    }
  }
  if (isReadonlyPropertySymbol(prop) && !('readOnly' in obj)) {
    result = { ...result, readOnly: true };
  }
  if (prop.flags & ts.SymbolFlags.Method && !('x-ts-method' in obj)) {
    result = { ...result, 'x-ts-method': true };
  }
  return result as SpecSchema;
}

/**
 * Alias-level x-ts-type is emitted when the alias RHS is a renderable
 * expression (array, instantiation, union, intersection, function, keyof, …).
 * Type-literal and mapped bodies are skipped — their structure is already
 * carried by schema.properties and the text would be the whole literal body.
 */
export function shouldEmitAliasTypeText(typeNode: ts.TypeNode): boolean {
  if (ts.isMappedTypeNode(typeNode)) return false;
  if (ts.isTypeLiteralNode(typeNode)) {
    // A type literal usually renders through its named members, so it needs no
    // type text. An index-signature-only literal (`{ [k: string]: V }`) has no
    // named members, so the text is the only thing a consumer can render.
    return (
      typeNode.members.length > 0 &&
      typeNode.members.every((m) => ts.isIndexSignatureDeclaration(m))
    );
  }
  return true;
}

// Primitive type names
export const PRIMITIVES: Set<string> = new Set([
  'string',
  'number',
  'boolean',
  'void',
  'undefined',
  'null',
  'any',
  'unknown',
  'never',
  'object',
  'symbol',
  'bigint',
]);

// Built-in generic types that use $ref + typeArguments
const BUILTIN_GENERICS = new Set([
  'Array',
  'ReadonlyArray',
  'Promise',
  'PromiseLike',
  'Map',
  'Set',
  'WeakMap',
  'WeakSet',
  'Iterable',
  'Iterator',
  'IterableIterator',
  'AsyncIterable',
  'AsyncIterator',
  'AsyncIterableIterator',
  'Generator',
  'AsyncGenerator',
  'Partial',
  'Required',
  'Readonly',
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
  'Awaited',
]);

// Utility types whose instantiations the checker resolves eagerly.
// Emitting `$ref: #/types/Omit` for these produces a dangling ref (lib types
// are never registered in types[]), so flatten to effective members instead.
const RESOLVED_UTILITY_TYPES = new Set([
  'Partial',
  'Required',
  'Readonly',
  'Pick',
  'Omit',
  'Record',
  'Exclude',
  'Extract',
  'NonNullable',
  'Awaited',
]);

// Built-in non-generic types
const BUILTIN_TYPES = new Set([
  'Date',
  'RegExp',
  'Error',
  'Function',
  'ArrayBuffer',
  'SharedArrayBuffer',
  'DataView',
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
]);

// Array prototype methods that should be skipped when processing tuple/array elements
// These methods cause "explosion" when empty arrays or tuples fall through to object handling
export const ARRAY_PROTOTYPE_METHODS: Set<string> = new Set([
  // Mutating methods
  'pop',
  'push',
  'shift',
  'unshift',
  'splice',
  'sort',
  'reverse',
  'fill',
  'copyWithin',
  // Accessor methods
  'concat',
  'join',
  'slice',
  'indexOf',
  'lastIndexOf',
  'includes',
  'find',
  'findIndex',
  'findLast',
  'findLastIndex',
  'filter',
  'map',
  'reduce',
  'reduceRight',
  'every',
  'some',
  'flat',
  'flatMap',
  'forEach',
  'entries',
  'keys',
  'values',
  'at',
  'with',
  'toReversed',
  'toSorted',
  'toSpliced',
  // Properties
  'length',
  // Iterator
  Symbol.iterator.toString(),
  // Other
  'toString',
  'toLocaleString',
]);

// String prototype methods — prevent explosion when string literal unions fall through to object handling
export const STRING_PROTOTYPE_METHODS: Set<string> = new Set([
  'charAt',
  'charCodeAt',
  'codePointAt',
  'concat',
  'endsWith',
  'includes',
  'indexOf',
  'lastIndexOf',
  'localeCompare',
  'match',
  'matchAll',
  'normalize',
  'padEnd',
  'padStart',
  'repeat',
  'replace',
  'replaceAll',
  'search',
  'slice',
  'split',
  'startsWith',
  'substring',
  'toLocaleLowerCase',
  'toLocaleUpperCase',
  'toLowerCase',
  'toUpperCase',
  'trim',
  'trimEnd',
  'trimStart',
  'at',
  'bold',
  'fixed',
  'italics',
  'link',
  'small',
  'strike',
  'sub',
  'sup',
  'anchor',
  'big',
  'blink',
  'fontcolor',
  'fontsize',
  'substr',
  'toString',
  'valueOf',
  'length',
]);

// Number prototype methods — prevent explosion when numeric enums fall through to object handling
export const NUMBER_PROTOTYPE_METHODS: Set<string> = new Set([
  'toFixed',
  'toExponential',
  'toPrecision',
  'toString',
  'valueOf',
  'toLocaleString',
]);

/**
 * Check if a name is a primitive type
 */
export function isPrimitiveName(name: string): boolean {
  return PRIMITIVES.has(name);
}

/**
 * Check if a symbol is from TypeScript's built-in lib (lib.es*.d.ts).
 * Used to detect Array, Object, and other built-in types.
 */
export function isBuiltinSymbol(symbol: ts.Symbol | undefined): boolean {
  if (!symbol) return false;
  const declarations = symbol.getDeclarations();
  if (!declarations || declarations.length === 0) return false;
  const sourceFile = declarations[0].getSourceFile();
  const fileName = sourceFile.fileName;
  // TypeScript lib files are in node_modules/typescript/lib/lib.*.d.ts
  return fileName.includes('/typescript/lib/lib.') || fileName.includes('\\typescript\\lib\\lib.');
}

/**
 * Get the origin package name for a type if it comes from node_modules.
 * Returns undefined for types defined in the current project.
 *
 * @example
 * getTypeOrigin(trpcRouterType) // Returns '@trpc/server'
 * getTypeOrigin(localUserType) // Returns undefined
 */
export function getTypeOrigin(type: ts.Type, _checker: ts.TypeChecker): string | undefined {
  const symbol = type.getSymbol() ?? type.aliasSymbol;
  if (!symbol) return undefined;

  const declarations = symbol.getDeclarations();
  if (!declarations || declarations.length === 0) return undefined;

  const fileName = declarations[0].getSourceFile().fileName;

  // Match node_modules package pattern
  // Handles: node_modules/@scope/package/... or node_modules/package/...
  const match = fileName.match(/node_modules\/(@[^/]+\/[^/]+|[^/]+)/);
  if (!match) return undefined;

  // Exclude TypeScript's built-in lib files
  if (match[1] === 'typescript') return undefined;

  return match[1];
}

/**
 * Check if a name is a built-in generic type
 */
export function isBuiltinGeneric(name: string): boolean {
  return BUILTIN_GENERICS.has(name);
}

/**
 * Check if a type is anonymous (no meaningful symbol name)
 */
export function isAnonymous(type: ts.Type): boolean {
  const symbol = type.getSymbol() || type.aliasSymbol;
  if (!symbol) return true;
  const name = symbol.getName();
  return name.startsWith('__') || name === '';
}

/**
 * Execute a function with incremented depth, automatically decrementing after.
 */
function withDepth<T>(ctx: SerializerContext, fn: () => T): T {
  ctx.currentDepth++;
  try {
    return fn();
  } finally {
    ctx.currentDepth--;
  }
}

/**
 * Check if we've exceeded the depth limit for the current context.
 */
function isAtMaxDepth(ctx: SerializerContext | undefined): boolean {
  if (!ctx) return false;
  return ctx.currentDepth >= ctx.maxTypeDepth;
}

/**
 * Ensure schema is non-empty — fallback to x-ts-type string representation if empty.
 * Never emit {} as a schema; always include meaningful type info.
 */
export function ensureNonEmptySchema(
  schema: SpecSchema,
  type: ts.Type,
  checker: ts.TypeChecker,
): SpecSchema {
  if (typeof schema === 'object' && schema !== null && !Array.isArray(schema)) {
    // Check if schema has no enumerable keys (would serialize to {})
    const keys = Object.keys(schema);
    if (keys.length === 0) {
      return { 'x-ts-type': checker.typeToString(type) };
    }
    // Check if schema would serialize to {} (all values undefined/function/symbol)
    try {
      const serialized = JSON.stringify(schema);
      if (serialized === '{}' || serialized === 'null') {
        return { 'x-ts-type': checker.typeToString(type) };
      }
    } catch {
      // JSON.stringify failed, return fallback
      return { 'x-ts-type': checker.typeToString(type) };
    }
  }
  return schema;
}

/**
 * Build a structured SpecSchema from a TypeScript type.
 * Uses $ref for named types and typeArguments for generics.
 * Guarantees non-empty schema output via ensureNonEmptySchema wrapper.
 */
export function buildSchema(
  type: ts.Type,
  checker: ts.TypeChecker,
  ctx?: SerializerContext,
): SpecSchema {
  const schema = buildSchemaInternal(type, checker, ctx);
  return ensureNonEmptySchema(schema, type, checker);
}

/**
 * Build a leaf schema at max depth — no further recursion.
 * Named types → $ref, primitives → inline, unions/intersections → decomposed.
 */
function buildMaxDepthSchema(type: ts.Type, checker: ts.TypeChecker): SpecSchema {
  // Type parameters are not addressable spec types — never $ref them.
  // (`this` types also carry TypeParameter flags but legitimately ref their class.)
  if (
    type.flags & ts.TypeFlags.TypeParameter &&
    (type as unknown as { isThisType?: boolean }).isThisType !== true
  ) {
    return { 'x-ts-type': checker.typeToString(type) } as SpecSchema;
  }

  // Named types → $ref (zero recursion)
  const symbol = type.getSymbol() || type.aliasSymbol;
  if (symbol && !isAnonymous(type)) {
    const name = symbol.getName();
    // Lib built-ins are never registered in types[] — inline a structural schema
    if (BUILTIN_TYPES.has(name) || isBuiltinGeneric(name)) {
      return builtinSchema(name);
    }
    if (!name.startsWith('__') && !isPrimitiveName(name)) {
      return { $ref: `#/types/${name}` };
    }
  }

  // Primitives
  if (type.flags & ts.TypeFlags.String) return { type: 'string' };
  if (type.flags & ts.TypeFlags.Number) return { type: 'number' };
  if (type.flags & ts.TypeFlags.Boolean) return { type: 'boolean' };
  if (type.flags & ts.TypeFlags.Undefined) return { type: 'undefined' };
  if (type.flags & ts.TypeFlags.Null) return { type: 'null' };
  if (type.flags & ts.TypeFlags.Void) return { type: 'void' };

  // Template literals → string + pattern (no recursion needed)
  if (type.flags & ts.TypeFlags.TemplateLiteral) {
    return {
      type: 'string',
      pattern: buildTemplatePattern(type as ts.TemplateLiteralType),
      'x-ts-type': renderTypeText(type, checker),
    } as SpecSchema;
  }

  // Unions → anyOf with leaf schemas per member
  if (type.isUnion()) {
    const schemas = type.types.map((t) => buildMaxDepthSchema(t, checker));
    return { anyOf: schemas };
  }

  // Intersections → allOf with leaf schemas per member
  if (type.isIntersection()) {
    const schemas = (type as ts.IntersectionType).types.map((t) => buildMaxDepthSchema(t, checker));
    return { allOf: schemas };
  }

  // Fallback
  return { type: checker.typeToString(type) };
}

/**
 * Internal schema builder - may return empty schemas for unhandled cases.
 */
function buildSchemaInternal(
  type: ts.Type,
  checker: ts.TypeChecker,
  ctx?: SerializerContext,
): SpecSchema {
  // Check depth limit using context
  // Named types can still emit $ref at max depth (zero recursion needed)
  // Union/intersection types get decomposed into anyOf/allOf with leaf schemas
  if (isAtMaxDepth(ctx)) {
    return buildMaxDepthSchema(type, checker);
  }

  // Circular reference guard — visitedTypes is stack-scoped (add before recurse, delete after)
  // Only fires during genuine circular recursion, not from registration pollution
  if (ctx?.visitedTypes.has(type)) {
    // Function types should be inlined, not ref'd
    const callSignatures = type.getCallSignatures();
    if (callSignatures.length > 0) {
      return buildFunctionSchema(callSignatures, checker, ctx);
    }
    const symbol = type.getSymbol() || type.aliasSymbol;
    // Named types → $ref (built-ins get structural schemas — never registered)
    if (symbol && !isAnonymous(type)) {
      const name = symbol.getName();
      if (BUILTIN_TYPES.has(name) || isBuiltinGeneric(name)) {
        return builtinSchema(name);
      }
      return { $ref: `#/types/${namedRefId(type, name, ctx)}` };
    }
    // Anonymous types → fallback
    return { type: checker.typeToString(type) };
  }

  // Add to visited BEFORE recursing, delete AFTER (stack-style)
  const addedToVisited = !!(ctx && type.flags & ts.TypeFlags.Object);
  if (addedToVisited) {
    ctx.visitedTypes.add(type);
  }

  try {
    // Handle primitives via type flags
    if (type.flags & ts.TypeFlags.String) return { type: 'string' };
    if (type.flags & ts.TypeFlags.Number) return { type: 'number' };
    if (type.flags & ts.TypeFlags.Boolean) return { type: 'boolean' };
    if (type.flags & ts.TypeFlags.Undefined) return { type: 'undefined' };
    if (type.flags & ts.TypeFlags.Null) return { type: 'null' };
    if (type.flags & ts.TypeFlags.Void) return { type: 'void' };
    if (type.flags & ts.TypeFlags.Any) return { type: 'any' };
    if (type.flags & ts.TypeFlags.Unknown) return { type: 'unknown' };
    if (type.flags & ts.TypeFlags.Never) return { type: 'never' };
    if (type.flags & ts.TypeFlags.BigInt) return { type: 'bigint' };
    if (type.flags & ts.TypeFlags.ESSymbol) return { type: 'symbol' };

    // Handle 'this' type - mark with x-ts-type for fluent patterns
    if ((type as unknown as { isThisType?: boolean }).isThisType === true) {
      // Get the constraint (the class type) and create a $ref with this marker
      const constraint = type.getConstraint?.();
      const symbol = constraint?.getSymbol() ?? type.getSymbol();
      if (symbol && !isAnonymous(type)) {
        return {
          $ref: `#/types/${ctx ? resolveTypeId(symbol, ctx) : symbol.getName()}`,
          'x-ts-type': 'this',
        } as SpecSchema;
      }
    }

    // Generic type parameters (T, U) are not addressable spec types — emit the
    // parameter name as x-ts-type text instead of a dangling $ref.
    if (type.flags & ts.TypeFlags.TypeParameter) {
      return { 'x-ts-type': checker.typeToString(type) } as SpecSchema;
    }

    // String literal
    if (type.flags & ts.TypeFlags.StringLiteral) {
      const literal = (type as ts.StringLiteralType).value;
      return { type: 'string', enum: [literal] };
    }

    // Number literal
    if (type.flags & ts.TypeFlags.NumberLiteral) {
      const literal = (type as ts.NumberLiteralType).value;
      return { type: 'number', enum: [literal] };
    }

    // Boolean literal (true/false)
    if (type.flags & ts.TypeFlags.BooleanLiteral) {
      const typeString = checker.typeToString(type);
      return { type: 'boolean', enum: [typeString === 'true'] };
    }

    // Named type aliases that resolve to unions/intersections → $ref BEFORE decomposing.
    // Without this, `type Foo = A & B` would be expanded as allOf instead of emitting $ref.
    // Only applies to non-generic aliases (generic aliases are handled later via aliasTypeArguments).
    if (type.aliasSymbol && !type.aliasTypeArguments?.length) {
      const aliasName = type.aliasSymbol.getName();
      if (!aliasName.startsWith('__') && !isPrimitiveName(aliasName)) {
        const packageOrigin = getTypeOrigin(type, checker);
        const schema: SpecSchema = { $ref: `#/types/${namedRefId(type, aliasName, ctx)}` };
        if (packageOrigin) {
          setSchemaExtension(schema, 'x-ts-package', packageOrigin);
        }
        return schema;
      }
    }

    // Template literal types → string with an approximating pattern
    if (type.flags & ts.TypeFlags.TemplateLiteral) {
      return {
        type: 'string',
        pattern: buildTemplatePattern(type as ts.TemplateLiteralType),
        'x-ts-type': renderTypeText(type, checker),
      } as SpecSchema;
    }

    // Intrinsic string mappings (Uppercase<T>, Lowercase<T>, ...) → string
    if (type.flags & ts.TypeFlags.StringMapping) {
      return { type: 'string', 'x-ts-type': renderTypeText(type, checker) } as SpecSchema;
    }

    // Union types → anyOf
    if (type.isUnion()) {
      // Check if this is a simple string/number literal union → enum
      const types = type.types;
      const allStringLiterals = types.every((t) => t.flags & ts.TypeFlags.StringLiteral);
      if (allStringLiterals) {
        const enumValues = types.map((t) => (t as ts.StringLiteralType).value);
        return { type: 'string', enum: enumValues };
      }

      const allNumberLiterals = types.every((t) => t.flags & ts.TypeFlags.NumberLiteral);
      if (allNumberLiterals) {
        const enumValues = types.map((t) => (t as ts.NumberLiteralType).value);
        return { type: 'number', enum: enumValues };
      }

      const allBooleanLiterals = types.every((t) => t.flags & ts.TypeFlags.BooleanLiteral);
      if (allBooleanLiterals) {
        return { type: 'boolean' };
      }

      // Collapse a true|false literal pair inside mixed unions to one boolean
      // branch (the checker decomposes `boolean | X` into literals)
      const isBoolLiteral = (t: ts.Type) => !!(t.flags & ts.TypeFlags.BooleanLiteral);
      let members: readonly ts.Type[] = types;
      if (types.filter(isBoolLiteral).length === 2) {
        const firstBool = types.findIndex(isBoolLiteral);
        members = types.filter((t, i) => !isBoolLiteral(t) || i === firstBool);
      }

      // General union → anyOf
      const buildBranch = (t: ts.Type): SpecSchema =>
        isBoolLiteral(t) ? { type: 'boolean' } : buildSchema(t, checker, ctx);
      if (ctx) {
        return withDepth(ctx, () => ({
          anyOf: members.map(buildBranch),
        }));
      }
      return { anyOf: members.map(buildBranch) };
    }

    // Intersection types → allOf
    // Use both isIntersection() and TypeFlags.Intersection to catch all cases
    const isIntersectionType = type.isIntersection() || !!(type.flags & ts.TypeFlags.Intersection);
    if (isIntersectionType && 'types' in type) {
      const intersectionType = type as ts.IntersectionType;
      // Filter out `never` types from intersection
      const filteredTypes = intersectionType.types.filter((t) => !(t.flags & ts.TypeFlags.Never));

      // Handle degenerate cases
      if (filteredTypes.length === 0) {
        return { type: 'never' };
      }
      if (filteredTypes.length === 1) {
        // Single-type intersection: return the single schema
        return buildSchema(filteredTypes[0], checker, ctx);
      }

      if (ctx) {
        return withDepth(ctx, () => ({
          allOf: filteredTypes.map((t) => buildSchema(t, checker, ctx)),
        }));
      }
      return { allOf: filteredTypes.map((t) => buildSchema(t, checker, ctx)) };
    }

    // EARLY CHECK: Detect empty arrays and Array interface BEFORE array/tuple checks
    // This prevents explosion where empty arrays fall through to object handling
    // and pick up all 50+ Array prototype methods
    const typeString = checker.typeToString(type);
    if (typeString === 'never[]' || typeString === '[]') {
      return { type: 'array', prefixItems: [], minItems: 0, maxItems: 0 };
    }

    // Detect Array interface to prevent prototype expansion
    const symbol = type.getSymbol() || type.aliasSymbol;
    if (symbol?.getName() === 'Array' && isBuiltinSymbol(symbol)) {
      // Get type arguments if available, otherwise use unknown
      const typeRef = type as ts.TypeReference;
      const typeArgs = typeRef.target ? checker.getTypeArguments(typeRef) : undefined;
      const elementType = typeArgs?.[0];
      if (elementType) {
        return { type: 'array', items: buildSchema(elementType, checker, ctx) };
      }
      return { type: 'array', items: { 'x-ts-type': 'unknown' } };
    }

    // Array type (T[])
    // Use checker.getTypeArguments() for consistent type argument resolution
    if (checker.isArrayType(type)) {
      const arrayTypeRef = type as ts.TypeReference;
      const arrayTypeArgs = checker.getTypeArguments(arrayTypeRef);
      const elementType = arrayTypeArgs?.[0];
      if (elementType) {
        if (ctx) {
          return withDepth(ctx, () => ({
            type: 'array',
            items: buildSchema(elementType, checker, ctx),
          }));
        }
        return { type: 'array', items: buildSchema(elementType, checker, ctx) };
      }
      return { type: 'array' };
    }

    // Tuple type - uses prefixItems per JSON Schema 2020-12
    // Use checker.getTypeArguments() for consistent type argument resolution
    if (checker.isTupleType(type)) {
      const tupleTypeRef = type as ts.TypeReference;
      const elementTypes = checker.getTypeArguments(tupleTypeRef) ?? [];
      if (ctx) {
        return withDepth(ctx, () => {
          // Set flag to indicate we're processing tuple elements
          const prevInTupleElement = ctx.inTupleElement;
          ctx.inTupleElement = true;
          try {
            return {
              type: 'array',
              prefixItems: elementTypes.map((t) => buildSchema(t, checker, ctx)),
              minItems: elementTypes.length,
              maxItems: elementTypes.length,
            };
          } finally {
            ctx.inTupleElement = prevInTupleElement;
          }
        });
      }
      return {
        type: 'array',
        prefixItems: elementTypes.map((t) => buildSchema(t, checker, ctx)),
        minItems: elementTypes.length,
        maxItems: elementTypes.length,
      };
    }

    // Generic type reference (Promise<T>, Result<T,E>, etc.)
    // Use checker.getTypeArguments() instead of typeRef.typeArguments as the latter
    // may not be populated for resolved types (e.g., from getReturnTypeOfSignature)
    const typeRef = type as ts.TypeReference;
    const typeArgs = typeRef.target ? checker.getTypeArguments(typeRef) : undefined;
    if (typeRef.target && typeArgs && typeArgs.length > 0) {
      const symbol = typeRef.target.getSymbol();
      const name = symbol?.getName();

      // Skip typeArguments for built-in non-generic types (like Uint8Array has internal T)
      if (name && BUILTIN_TYPES.has(name)) {
        return builtinSchema(name);
      }

      // Built-in generics (Promise<T>, Map<K,V>) are never registered in types[] —
      // inline a structural schema and keep the instantiation via typeArguments.
      if (name && isBuiltinGeneric(name)) {
        const build = (): SpecSchema => ({
          ...builtinSchema(name),
          typeArguments: typeArgs.map((t) => buildSchema(t, checker, ctx)),
        });
        return ctx ? withDepth(ctx, build) : build();
      }

      if (name && !isAnonymous(typeRef.target)) {
        const packageOrigin = getTypeOrigin(typeRef.target, checker);
        if (ctx) {
          return withDepth(ctx, () => {
            const schema: SpecSchema = {
              $ref: `#/types/${namedRefId(typeRef.target, name, ctx)}`,
              typeArguments: typeArgs.map((t) => buildSchema(t, checker, ctx)),
            };
            if (packageOrigin) {
              setSchemaExtension(schema, 'x-ts-package', packageOrigin);
            }
            return schema;
          });
        }
        const schema: SpecSchema = {
          $ref: `#/types/${name}`,
          typeArguments: typeArgs.map((t) => buildSchema(t, checker, ctx)),
        };
        if (packageOrigin) {
          setSchemaExtension(schema, 'x-ts-package', packageOrigin);
        }
        return schema;
      }
    }

    // Fallback: check aliasTypeArguments for types where typeRef.target is undefined
    // This handles cases like return types from getReturnTypeOfSignature() where
    // the type has generic arguments via aliasSymbol/aliasTypeArguments
    const aliasTypeArgs = type.aliasTypeArguments;
    const aliasSymbol = type.aliasSymbol;
    if (aliasSymbol && aliasTypeArgs && aliasTypeArgs.length > 0) {
      const name = aliasSymbol.getName();

      // Skip built-in non-generic types
      if (BUILTIN_TYPES.has(name)) {
        return builtinSchema(name);
      }

      // Utility-type instantiations (Omit<Config, 'x'>, Partial<T>, Record<K, V>)
      // are already resolved by the checker — flatten to their effective members.
      // Deferred instantiations (generic context, e.g. Omit<T, 'x'> where T is a
      // type parameter) have no members and keep the $ref + typeArguments form.
      if (RESOLVED_UTILITY_TYPES.has(name) && type.flags & ts.TypeFlags.Object) {
        const props = type.getProperties();
        const hasIndex = checker.getIndexInfosOfType(type).length > 0;
        if (props.length > 0 || hasIndex) {
          return buildObjectSchema(props, checker, ctx, type);
        }
      }

      // Built-in generics (incl. deferred utility instantiations like Omit<T, K>
      // in generic context) are never registered in types[] — inline structural
      // schema + typeArguments instead of a dangling $ref.
      if (isBuiltinGeneric(name)) {
        const build = (): SpecSchema => ({
          ...builtinSchema(name),
          typeArguments: aliasTypeArgs.map((t) => buildSchema(t, checker, ctx)),
        });
        return ctx ? withDepth(ctx, build) : build();
      }

      if (!name.startsWith('__')) {
        const packageOrigin = getTypeOrigin(type, checker);
        if (ctx) {
          return withDepth(ctx, () => {
            const schema: SpecSchema = {
              $ref: `#/types/${namedRefId(type, name, ctx)}`,
              typeArguments: aliasTypeArgs.map((t) => buildSchema(t, checker, ctx)),
            };
            if (packageOrigin) {
              setSchemaExtension(schema, 'x-ts-package', packageOrigin);
            }
            return schema;
          });
        }
        const schema: SpecSchema = {
          $ref: `#/types/${name}`,
          typeArguments: aliasTypeArgs.map((t) => buildSchema(t, checker, ctx)),
        };
        if (packageOrigin) {
          setSchemaExtension(schema, 'x-ts-package', packageOrigin);
        }
        return schema;
      }
    }

    // Function types - check BEFORE named types to avoid $ref to function names
    if (type.flags & ts.TypeFlags.Object) {
      const callSignatures = type.getCallSignatures();
      if (callSignatures.length > 0) {
        return buildFunctionSchema(callSignatures, checker, ctx);
      }
    }

    // Named types (classes, interfaces, type aliases)
    // (symbol already declared above for Array interface check)
    if (symbol && !isAnonymous(type)) {
      const name = symbol.getName();

      // Skip primitives
      if (isPrimitiveName(name)) {
        return { type: name };
      }

      // Built-in types without generics
      if (BUILTIN_TYPES.has(name)) {
        return builtinSchema(name);
      }

      // Built-in generics reached without type arguments (bare Promise, Map).
      // Symbol check avoids shadowing user types that share a builtin name.
      if (isBuiltinGeneric(name) && isBuiltinSymbol(symbol)) {
        return builtinSchema(name);
      }

      // Named type → $ref
      if (!name.startsWith('__')) {
        const packageOrigin = getTypeOrigin(type, checker);
        const schema: SpecSchema = { $ref: `#/types/${namedRefId(type, name, ctx)}` };
        if (packageOrigin) {
          setSchemaExtension(schema, 'x-ts-package', packageOrigin);
        }
        return schema;
      }
    }

    // Object type (inline object literal)
    if (type.flags & ts.TypeFlags.Object) {
      const objectType = type as ts.ObjectType;

      // Object with properties or index signatures (index-only types like
      // { [k: number]: string } have zero properties but real structure)
      const properties = type.getProperties();
      if (
        properties.length > 0 ||
        objectType.objectFlags & ts.ObjectFlags.Anonymous ||
        checker.getIndexInfosOfType(type).length > 0
      ) {
        return buildObjectSchema(properties, checker, ctx, type);
      }
    }

    // Fallback to type string
    return { type: checker.typeToString(type) };
  } finally {
    // Stack-style cleanup: remove from visited after processing completes
    if (addedToVisited) {
      ctx?.visitedTypes.delete(type);
    }
  }
}

/**
 * Build schema for function types
 */
export function buildFunctionSchema(
  callSignatures: readonly ts.Signature[],
  checker: ts.TypeChecker,
  ctx: SerializerContext | undefined,
): SpecSchema {
  const buildSignatures = () => {
    const signatures: SpecSignature[] = callSignatures.map((sig) => {
      const params = sig.getParameters().flatMap((param) => {
        const decl = param.valueDeclaration as ts.ParameterDeclaration | undefined;
        if (!decl) return [];
        const paramType = checker.getTypeOfSymbolAtLocation(param, decl);
        const isOptional = !!decl?.questionToken || !!decl?.initializer;
        // Optionality is expressed via required: false — strip the undefined
        // branch so the schema doesn't also accept null after normalization
        const effectiveType = isOptional ? stripUndefinedFromType(paramType, checker) : paramType;
        return {
          name: param.getName(),
          schema: buildSchema(effectiveType, checker, ctx),
          required: !isOptional,
        };
      });

      const returnType = checker.getReturnTypeOfSignature(sig);

      return {
        parameters: params,
        returns: {
          schema: buildSchema(returnType, checker, ctx),
        },
      };
    });
    return signatures;
  };

  if (ctx) {
    return withDepth(ctx, () => ({ type: 'function', signatures: buildSignatures() }));
  }
  return { type: 'function', signatures: buildSignatures() };
}

/**
 * Build schema for object types with properties
 */
export function buildObjectSchema(
  properties: ts.Symbol[],
  checker: ts.TypeChecker,
  ctx: SerializerContext | undefined,
  originalType?: ts.Type,
): SpecSchema {
  // Only filter array prototype methods when the type is actually array-like.
  const isArrayLikeType = originalType
    ? checker.isArrayType(originalType) ||
      checker.isTupleType(originalType) ||
      (originalType.symbol?.getName() === 'Array' && isBuiltinSymbol(originalType.symbol))
    : false;

  // String/number-like types expose their prototype as apparent properties —
  // filter them so primitive-backed types never explode into charAt/toFixed
  const isStringLikeType = !!(originalType && originalType.flags & ts.TypeFlags.StringLike);
  const isNumberLikeType = !!(originalType && originalType.flags & ts.TypeFlags.NumberLike);

  const buildProps = () => {
    const props: Record<string, SpecSchema> = {};
    const required: string[] = [];

    for (const prop of properties) {
      const propName = prop.getName();
      // Skip symbol-keyed members (checker-internal `__@iterator@…` names).
      // Underscore-prefixed members are real API surface and must survive —
      // the export serializers keep them, so schema paths must match.
      if (propName.startsWith('__@')) continue;

      // Skip Array prototype methods only when the type is actually array-like.
      // Previously this was unconditional, which dropped real methods named
      // "find", "keys", "values", "entries", etc. from plain objects.
      if (isArrayLikeType && ARRAY_PROTOTYPE_METHODS.has(propName)) {
        continue;
      }
      if (isStringLikeType && STRING_PROTOTYPE_METHODS.has(propName)) {
        continue;
      }
      if (isNumberLikeType && NUMBER_PROTOTYPE_METHODS.has(propName)) {
        continue;
      }

      const isOptionalProp = !!(prop.flags & ts.SymbolFlags.Optional);
      const rawPropType = checker.getTypeOfSymbol(prop);
      // Optional props: omission from `required` carries the optionality —
      // strip undefined so the wire schema doesn't also admit null
      const propType = isOptionalProp ? stripUndefinedFromType(rawPropType, checker) : rawPropType;
      let propSchema = buildSchema(propType, checker, ctx);

      // Carry doc comments into the flattened schema so consumers reading only
      // schema.properties (not members[]) still see per-property descriptions.
      // getDocumentationComment works for .d.ts inputs too.
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

    const schema: SpecSchema = {
      type: 'object' as const,
      properties: props,
      ...(required.length > 0 ? { required } : {}),
    };

    // Index signatures ({ [key: string]: V }, Record<string, V>) → additionalProperties
    const indexInfos = originalType ? checker.getIndexInfosOfType(originalType) : [];
    const stringIndex = indexInfos.find((i) => i.keyType.flags & ts.TypeFlags.String);
    if (stringIndex) {
      (schema as Record<string, unknown>).additionalProperties = buildSchema(
        stringIndex.type,
        checker,
        ctx,
      );
    }

    // Number index signatures — JSON keys are strings, so approximate with
    // patternProperties over digit keys
    const numberIndex = indexInfos.find((i) => i.keyType.flags & ts.TypeFlags.Number);
    if (numberIndex) {
      (schema as Record<string, unknown>).patternProperties = {
        '^\\d+$': buildSchema(numberIndex.type, checker, ctx),
      };
      setSchemaExtension(schema, 'x-ts-index-key', 'number');
    }

    // Add x-ts-type for empty properties to provide context
    if (Object.keys(props).length === 0 && originalType && !stringIndex && !numberIndex) {
      setSchemaExtension(schema, 'x-ts-type', checker.typeToString(originalType));
    }

    return schema;
  };

  if (ctx) {
    return withDepth(ctx, buildProps);
  }
  return buildProps();
}

// ============================================================================
// Schema Utilities (ported from SDK)
// ============================================================================

/**
 * Check if a schema is a pure $ref (only has $ref property)
 */
export function isPureRefSchema(schema: SpecSchema): schema is { $ref: string } {
  return typeof schema === 'object' && Object.keys(schema).length === 1 && '$ref' in schema;
}

/**
 * Add description to a schema, handling $ref properly.
 * For pure $ref schemas, wraps in allOf to preserve the reference.
 */
export function withDescription(schema: SpecSchema, description: string): SpecSchema {
  if (typeof schema === 'string') {
    return { type: schema, description };
  }
  if (isPureRefSchema(schema)) {
    return {
      allOf: [schema],
      description,
    };
  }
  return { ...schema, description };
}

/**
 * Mark a schema as deprecated, handling $ref properly.
 * For pure $ref schemas, wraps in allOf to preserve the reference.
 */
export function withDeprecated(schema: SpecSchema, reason?: string): SpecSchema {
  const extra: Record<string, unknown> = { deprecated: true };
  if (reason?.trim()) {
    extra['x-deprecated-reason'] = reason;
  }
  if (typeof schema === 'string') {
    return { type: schema, ...extra };
  }
  if (isPureRefSchema(schema)) {
    return { allOf: [schema], ...extra };
  }
  return { ...schema, ...extra };
}

/**
 * Check if a schema represents the 'any' type
 */
export function schemaIsAny(schema: SpecSchema): boolean {
  if (typeof schema === 'string') {
    return schema === 'any';
  }
  if ('type' in schema && schema.type === 'any' && Object.keys(schema).length === 1) {
    return true;
  }
  return false;
}

/**
 * Deep equality comparison for schemas
 */
export function schemasAreEqual(left: SpecSchema, right: SpecSchema): boolean {
  if (typeof left !== typeof right) {
    return false;
  }
  if (typeof left === 'string' && typeof right === 'string') {
    return left === right;
  }
  if (left == null || right == null) {
    return left === right;
  }

  const normalize = (value: unknown): unknown => {
    if (Array.isArray(value)) {
      return value.map((item) => normalize(item));
    }
    if (value && typeof value === 'object') {
      const sortedEntries = Object.entries(value)
        .map(([key, val]) => [key, normalize(val)] as const)
        .sort(([keyA], [keyB]) => keyA.localeCompare(keyB));
      return Object.fromEntries(sortedEntries);
    }
    return value;
  };

  return JSON.stringify(normalize(left)) === JSON.stringify(normalize(right));
}

/**
 * Remove duplicate schemas from an array while preserving order.
 */
export function deduplicateSchemas(schemas: SpecSchema[]): SpecSchema[] {
  const result: SpecSchema[] = [];
  for (const schema of schemas) {
    const isDuplicate = result.some((existing) => schemasAreEqual(existing, schema));
    if (!isDuplicate) {
      result.push(schema);
    }
  }
  return result;
}

/**
 * Find a discriminator property in a union of object types (tagged union pattern).
 * A valid discriminator has a unique literal value in each union member.
 */
export function findDiscriminatorProperty(
  unionTypes: ts.Type[],
  checker: ts.TypeChecker,
): string | undefined {
  const memberProps: Map<string, string | number>[] = [];

  for (const t of unionTypes) {
    // Skip null/undefined in unions
    if (t.flags & (ts.TypeFlags.Null | ts.TypeFlags.Undefined)) {
      continue;
    }

    const props = t.getProperties();
    if (!props || props.length === 0) {
      return undefined; // Not an object type
    }

    const propValues = new Map<string, string | number>();
    for (const prop of props) {
      const declaration = prop.valueDeclaration ?? prop.declarations?.[0];
      if (!declaration) continue;

      try {
        const propType = checker.getTypeOfSymbolAtLocation(prop, declaration);
        if (propType.isStringLiteral()) {
          propValues.set(prop.getName(), propType.value);
        } else if (propType.isNumberLiteral()) {
          propValues.set(prop.getName(), propType.value);
        }
      } catch {
        // Ignore errors
      }
    }
    memberProps.push(propValues);
  }

  if (memberProps.length < 2) {
    return undefined; // Need at least 2 object members
  }

  // Find property that exists in all members with unique literal values
  const firstMember = memberProps[0];
  for (const [propName, firstValue] of firstMember) {
    const values = new Set<string | number>([firstValue]);
    let isDiscriminator = true;

    for (let i = 1; i < memberProps.length; i++) {
      const value = memberProps[i].get(propName);
      if (value === undefined) {
        isDiscriminator = false;
        break;
      }
      if (values.has(value)) {
        // Duplicate value - not a valid discriminator
        isDiscriminator = false;
        break;
      }
      values.add(value);
    }

    if (isDiscriminator) {
      return propName;
    }
  }

  return undefined;
}
