import type { SpecSignatureParameter } from '@openpkg-ts/spec';
import ts from 'typescript';
import { declaredForm } from '../ast/registry';
import { isForeignPackage } from '../ast/type-identity';
import {
  bindingPatternKind,
  destructuredParamName,
  getParamDescription,
  jsdocParamTagName,
  parseInlineTags,
} from '../ast/utils';
import type { SerializerContext } from '../serializers/context';
import {
  buildSchema,
  buildSchemaFromTypeNode,
  isDeferredMappedOrConditional,
  stripUndefinedFromType,
  typeNodeDefersExpansion,
} from './schema-builder';

export function extractParameters(
  signature: ts.Signature,
  ctx: SerializerContext,
): SpecSignatureParameter[] {
  const { typeChecker: checker } = ctx;
  const result: SpecSignatureParameter[] = [];

  // Get JSDoc tags from the signature declaration for param descriptions
  const signatureDecl = signature.getDeclaration();
  const jsdocTags = signatureDecl ? ts.getJSDocTags(signatureDecl) : [];
  const names = destructuredNames(signature.getParameters(), jsdocTags);

  for (const param of signature.getParameters()) {
    const decl = param.valueDeclaration as ts.ParameterDeclaration | undefined;
    if (!decl) continue;
    const defer = typeNodeDefersExpansion(decl.type, checker, ctx.program);
    const type = defer ? undefined : checker.getTypeOfSymbolAtLocation(param, decl);

    // Optionality comes from `?` or an initializer, on the pattern itself for
    // a destructured parameter (`{ a } = {}`), never from its keys.
    const isOptional = !!decl.questionToken || !!decl.initializer;
    const isRest = !!decl.dotDotDotToken;

    // A binding pattern is ONE positional argument. The checker calls it
    // `__0`; the spec gives it a readable name and the declared object type.
    const pattern = bindingPatternKind(decl);
    const paramName = pattern ? (names.get(param) ?? param.getName()) : param.getName();
    const description = getParamDescription(paramName, jsdocTags);

    const schema = defer
      ? buildSchemaFromTypeNode(decl.type as ts.TypeNode, checker, ctx)
      : buildSchema(
          isOptional ? stripUndefinedFromType(type as ts.Type, checker) : (type as ts.Type),
          checker,
          ctx,
          decl.type,
        );
    if (!defer && type) {
      registerReferencedTypes(isOptional ? stripUndefinedFromType(type, checker) : type, ctx);
    }

    const paramResult: SpecSignatureParameter = {
      name: paramName,
      schema,
      // A rest parameter accepts zero arguments, so it is never required.
      required: !isOptional && !isRest,
      ...(isRest ? { rest: true } : {}),
      ...(pattern ? { 'x-ts-destructured': true } : {}),
    };

    if (description) {
      paramResult.description = description;
      const inlineTags = parseInlineTags(description);
      if (inlineTags) paramResult.inlineTags = inlineTags;
    }

    if (decl.initializer) {
      applyDefault(paramResult, decl.initializer);
    }

    if (pattern === 'object') {
      annotateBindingElements(decl.name as ts.ObjectBindingPattern, paramResult, jsdocTags);
    }

    result.push(paramResult);
  }

  return result;
}

/**
 * Pick a public name for each destructured parameter of a signature.
 * A `@param` tag that names the pattern wins: `@param opts.host` (dotted, the
 * prefix is the name) or a bare `@param opts` that no identifier parameter
 * and no destructured key claims (`@param model` documents the key `model`,
 * not the pattern). Otherwise `options` / `args`, kept distinct from the
 * other parameters.
 */
function destructuredNames(
  params: readonly ts.Symbol[],
  jsdocTags: readonly ts.JSDocTag[],
): Map<ts.Symbol, string> {
  const names = new Map<ts.Symbol, string>();
  const taken = new Set<string>();
  const keys = new Set<string>();
  const patterns: Array<{ symbol: ts.Symbol; kind: 'object' | 'array' }> = [];

  for (const param of params) {
    const decl = param.valueDeclaration as ts.ParameterDeclaration | undefined;
    const kind = bindingPatternKind(decl);
    if (!kind) {
      taken.add(param.getName());
      continue;
    }
    patterns.push({ symbol: param, kind });
    const name = (decl as ts.ParameterDeclaration).name as ts.BindingPattern;
    for (const element of name.elements) {
      const key = bindingElementKey(element);
      if (key) keys.add(key);
    }
  }
  if (patterns.length === 0) return names;

  // `@param` names not claimed by an identifier parameter or a destructured
  // key, in source order. A dotted tag (`opts.host`) contributes its prefix.
  const candidates: string[] = [];
  for (const tag of jsdocTags) {
    const [tagName, ...rest] = jsdocParamTagName(tag).split('.');
    if (!tagName || tagName.startsWith('__') || taken.has(tagName)) continue;
    if (rest.length === 0 && keys.has(tagName)) continue;
    if (!candidates.includes(tagName)) candidates.push(tagName);
  }

  patterns.forEach(({ symbol, kind }, i) => {
    const name = destructuredParamName(kind, taken, candidates[i]);
    taken.add(name);
    names.set(symbol, name);
  });
  return names;
}

/** Public property name an object-pattern element binds (`{ model: local }` → `model`). */
function bindingElementKey(element: ts.ArrayBindingElement): string | undefined {
  if (!ts.isBindingElement(element) || element.dotDotDotToken) return undefined;
  const key = element.propertyName ?? element.name;
  if (ts.isIdentifier(key)) return key.text;
  if (ts.isStringLiteral(key) || ts.isNumericLiteral(key)) return key.text;
  return undefined;
}

/**
 * Carry what the binding elements say about the keys — `= default` and
 * `@param name.key` descriptions — onto the matching property schemas.
 * Only an inline object schema can take them; a `$ref` is left as is.
 */
function annotateBindingElements(
  pattern: ts.ObjectBindingPattern,
  param: SpecSignatureParameter,
  jsdocTags: readonly ts.JSDocTag[],
): void {
  const schema = param.schema as Record<string, unknown>;
  const properties = schema?.properties as Record<string, unknown> | undefined;
  if (!properties) return;

  for (const element of pattern.elements) {
    const propertyName = bindingElementKey(element);
    if (!propertyName) continue;

    const prop = properties[propertyName];
    if (!prop || typeof prop !== 'object' || Array.isArray(prop)) continue;
    const propSchema = prop as Record<string, unknown>;

    const description = getParamDescription(propertyName, jsdocTags, param.name);
    if (description && propSchema.description === undefined) {
      propSchema.description = description;
    }

    if (element.initializer) {
      const extracted = extractLiteralDefault(element.initializer);
      if (extracted.literal) propSchema.default = extracted.value;
      else propSchema['x-ts-default'] = extracted.text;
    }
  }
}

/**
 * Extract a default from an initializer expression.
 * Literals produce a JSON value; anything else (identifiers, calls, `as`)
 * is source text. `parameter.default` is the documented home for both.
 */
function extractLiteralDefault(
  initializer: ts.Expression,
): { literal: true; value: unknown } | { literal: false; text: string } {
  if (ts.isStringLiteral(initializer)) {
    return { literal: true, value: initializer.text };
  }
  if (ts.isNumericLiteral(initializer)) {
    return { literal: true, value: Number(initializer.text) };
  }
  if (
    ts.isPrefixUnaryExpression(initializer) &&
    initializer.operator === ts.SyntaxKind.MinusToken &&
    ts.isNumericLiteral(initializer.operand)
  ) {
    return { literal: true, value: -Number(initializer.operand.text) };
  }
  if (initializer.kind === ts.SyntaxKind.TrueKeyword) {
    return { literal: true, value: true };
  }
  if (initializer.kind === ts.SyntaxKind.FalseKeyword) {
    return { literal: true, value: false };
  }
  if (initializer.kind === ts.SyntaxKind.NullKeyword) {
    return { literal: true, value: null };
  }
  return { literal: false, text: initializer.getText() };
}

/**
 * Apply an initializer to a parameter.
 * `parameter.default` is the documented home: JSON value for literals,
 * source text for expressions. `schema.default` stays JSON Schema (literals).
 * `x-ts-default` stays on the schema for expression text (compat).
 */
function applyDefault(param: SpecSignatureParameter, initializer: ts.Expression): void {
  const extracted = extractLiteralDefault(initializer);
  if (extracted.literal) {
    param.default = extracted.value;
    if (param.schema && typeof param.schema === 'object' && !Array.isArray(param.schema)) {
      (param.schema as Record<string, unknown>).default = extracted.value;
    }
  } else {
    param.default = extracted.text;
    if (param.schema && typeof param.schema === 'object' && !Array.isArray(param.schema)) {
      (param.schema as Record<string, unknown>)['x-ts-default'] = extracted.text;
    }
  }
}

/**
 * Recursively register types referenced by a ts.Type.
 * Uses ctx.registeredTypes to prevent re-processing already-registered types.
 */
export function registerReferencedTypes(type: ts.Type, ctx: SerializerContext, depth = 0): void {
  // Limit traversal depth to prevent explosion
  if (depth > ctx.maxTypeDepth) return;

  // Prevent re-registration of already-processed types
  if (ctx.registeredTypes.has(type)) return;

  // Only add complex types to registeredTypes (not primitives/literals which can't be circular)
  const isPrimitive =
    type.flags &
    (ts.TypeFlags.String |
      ts.TypeFlags.Number |
      ts.TypeFlags.Boolean |
      ts.TypeFlags.Void |
      ts.TypeFlags.Undefined |
      ts.TypeFlags.Null |
      ts.TypeFlags.Any |
      ts.TypeFlags.Unknown |
      ts.TypeFlags.Never |
      ts.TypeFlags.StringLiteral |
      ts.TypeFlags.NumberLiteral |
      ts.TypeFlags.BooleanLiteral);

  if (!isPrimitive) {
    ctx.registeredTypes.add(type);
  }

  const { typeChecker: checker, typeRegistry } = ctx;

  // Register the type itself
  typeRegistry.registerType(type, ctx);

  // Handle type arguments (generics like Array<T>, Promise<T>)
  const typeArgs = (type as ts.TypeReference).typeArguments;
  if (typeArgs) {
    for (const arg of typeArgs) {
      registerReferencedTypes(arg, ctx, depth + 1);
    }
  }

  // Alias arguments (`Result<Ok, Err>`) are references too
  for (const arg of type.aliasTypeArguments ?? []) {
    registerReferencedTypes(arg, ctx, depth + 1);
  }

  // An instantiation (`Box<string>`) references what its declaration
  // (`Box<T>`) references, plus its arguments (walked above). Walking the
  // declaration instead is shared by every instantiation; walking each one
  // makes the checker resolve the whole member graph again per use (zod: 80
  // schema classes over one generic base).
  const declared = declaredForm(type, checker);
  if (declared !== type) {
    registerReferencedTypes(declared, ctx, depth);
    return;
  }

  // Handle union types
  if (type.isUnion()) {
    for (const t of type.types) {
      registerReferencedTypes(t, ctx, depth + 1);
    }
  }

  // Handle intersection types
  if (type.isIntersection()) {
    for (const t of type.types) {
      registerReferencedTypes(t, ctx, depth + 1);
    }
  }

  // Skip member recursion for types outside the expansion scope — their
  // registry entry is an opaque stub, so walking properties would only drag
  // transitive ambient types (Event, EventTarget, ...) into types[]
  const typeSymbol = type.aliasSymbol ?? type.getSymbol();
  if (
    typeSymbol &&
    ctx.shouldExpandExternal &&
    !typeSymbol.getName().startsWith('__') &&
    !ctx.shouldExpandExternal(typeSymbol)
  ) {
    return;
  }

  // followExternal expands the named type's own schema via registerType.
  // Recursing into foreign class methods (ZodObject.parse, .optional, …)
  // fans out through generic instantiations and OOMs; maxTypeDepth does
  // not bound that combinatorial walk.
  if (isForeignPackage(typeSymbol, ctx.workspacePackages)) {
    return;
  }

  // Recursive mapped/conditional types: registering the name is enough.
  if (isDeferredMappedOrConditional(type)) {
    return;
  }

  // Handle object properties (traverse into object members)
  if (type.flags & ts.TypeFlags.Object) {
    const props = type.getProperties();
    const limit = ctx.maxProperties;
    if (props.length > limit && ctx.onTruncation) {
      const typeName = type.getSymbol()?.getName() ?? 'anonymous';
      ctx.onTruncation(typeName, props.length, limit);
    }
    for (const prop of props.slice(0, limit)) {
      const propType = checker.getTypeOfSymbol(prop);
      registerReferencedTypes(propType, ctx, depth + 1);
    }
  }
}
