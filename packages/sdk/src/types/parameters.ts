import type { SpecSchema, SpecSignatureParameter } from '@openpkg-ts/spec';
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
  buildObjectSchema,
  buildSchema,
  buildSchemaFromTypeNode,
  isDeferredMappedOrConditional,
  renderTypeText,
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
  const names = destructuredNames(signature.getParameters(), jsdocTags, checker);

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

    let schema = defer
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
    if (pattern === 'object') {
      schema = resolvedObjectSchema(schema, param, decl, isOptional, ctx);
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
  checker: ts.TypeChecker,
): Map<ts.Symbol, string> {
  const names = new Map<ts.Symbol, string>();
  const taken = new Set<string>();
  const patterns: Array<{
    symbol: ts.Symbol;
    decl: ts.ParameterDeclaration;
    kind: 'object' | 'array';
  }> = [];

  for (const param of params) {
    const decl = param.valueDeclaration as ts.ParameterDeclaration | undefined;
    const kind = bindingPatternKind(decl);
    if (!kind || !decl) {
      taken.add(param.getName());
      continue;
    }
    patterns.push({ symbol: param, decl, kind });
  }
  if (patterns.length === 0) return names;

  // `@param` names not claimed by an identifier parameter or a key of any
  // destructured parameter's type, in source order. A dotted tag
  // (`opts.host`) contributes its prefix. Keys come from the checker, not the
  // pattern: `@param maxOutputTokens` documents a key reached via `...rest`.
  const tagNames = jsdocTags.map(jsdocParamTagName).filter((n) => n && !n.startsWith('__'));
  if (tagNames.length === 0) {
    for (const { symbol, kind } of patterns) {
      const name = destructuredParamName(kind, taken);
      taken.add(name);
      names.set(symbol, name);
    }
    return names;
  }

  const keys = new Set<string>();
  for (const { symbol, decl } of patterns) {
    for (const element of (decl.name as ts.BindingPattern).elements) {
      const key = bindingElementKey(element);
      if (key) keys.add(key);
    }
    const type = checker.getTypeOfSymbolAtLocation(symbol, decl);
    for (const prop of resolvedProperties(type, checker)) keys.add(prop.getName());
  }

  const candidates: string[] = [];
  for (const tagName of tagNames) {
    const [head, ...rest] = tagName.split('.');
    if (taken.has(head)) continue;
    if (rest.length === 0 && keys.has(head)) continue;
    if (!candidates.includes(head)) candidates.push(head);
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
 * Every property the checker sees on a type, across union arms. `apparent`
 * resolves mapped/conditional and intersection types to their members.
 *
 * A key present in several arms takes the first arm that types it: in a
 * discriminated union (`{ prompt: P; messages?: never } | { messages: M }`)
 * the `never` arm only says the key is absent there, not what it holds.
 */
function resolvedProperties(type: ts.Type, checker: ts.TypeChecker): ts.Symbol[] {
  const seen = new Map<string, ts.Symbol>();
  for (const arm of objectArms(type, checker)) {
    for (const prop of armProperties(arm, checker)) {
      const name = prop.getName();
      const current = seen.get(name);
      if (!current || (isAbsentMarker(current, checker) && !isAbsentMarker(prop, checker))) {
        seen.set(name, prop);
      }
    }
  }
  return [...seen.values()];
}

/** `key?: never` — the arm has no such key. Its type says nothing about the key. */
function isAbsentMarker(prop: ts.Symbol, checker: ts.TypeChecker): boolean {
  const type = stripUndefinedFromType(checker.getTypeOfSymbol(prop), checker);
  return !!(type.flags & (ts.TypeFlags.Never | ts.TypeFlags.Undefined));
}

/** Names an arm requires. */
function armRequiredNames(arm: ts.Type, checker: ts.TypeChecker): Set<string> {
  return new Set(
    armProperties(arm, checker)
      .filter((p) => !(p.flags & ts.SymbolFlags.Optional))
      .map((p) => p.getName()),
  );
}

const PRIMITIVE_LIKE =
  ts.TypeFlags.StringLike |
  ts.TypeFlags.NumberLike |
  ts.TypeFlags.BigIntLike |
  ts.TypeFlags.BooleanLike |
  ts.TypeFlags.ESSymbolLike |
  ts.TypeFlags.Void |
  ts.TypeFlags.Undefined |
  ts.TypeFlags.Null;

/** Union arms (or the type itself) that carry properties and are not primitives. */
function objectArms(type: ts.Type, checker: ts.TypeChecker): ts.Type[] {
  const arms = type.isUnion() ? type.types : [type];
  return arms.filter(
    (arm) => !(arm.flags & PRIMITIVE_LIKE) && armProperties(arm, checker).length > 0,
  );
}

/**
 * Properties of one arm. The arm's own view first: an intersection holding a
 * conditional member distributes under `getApparentType` into a union, which
 * would hide the keys the intersection itself already resolves.
 */
function armProperties(arm: ts.Type, checker: ts.TypeChecker): ts.Symbol[] {
  const own = checker.getPropertiesOfType(arm);
  return own.length > 0 ? own : checker.getPropertiesOfType(checker.getApparentType(arm));
}

/**
 * A destructured parameter must expose its keys. When the declared type is
 * not an inline object literal — an intersection (`CallSettings & { model }`),
 * a union of objects, a mapped/conditional alias — resolve it to the object
 * the checker sees: `properties` from the apparent type, `required` for the
 * keys required in every union arm, the written form under `x-ts-type`.
 *
 * A union keeps its per-arm requiredness as `anyOf: [{ required: [...] }]`,
 * each arm listing only what it requires beyond the shared `required`
 * (`prompt` | `messages`). Arms that require nothing more make the constraint
 * vacuous, so then it is omitted entirely, as it is when every arm agrees.
 *
 * A `$ref` to a named type is kept as is: the target carries the properties.
 */
function resolvedObjectSchema(
  schema: SpecSchema,
  param: ts.Symbol,
  decl: ts.ParameterDeclaration,
  isOptional: boolean,
  ctx: SerializerContext,
): SpecSchema {
  if (typeof schema !== 'object' || schema === null || Array.isArray(schema)) return schema;
  const current = schema as Record<string, unknown>;
  if (current.properties || current.$ref) return schema;

  const { typeChecker: checker } = ctx;
  const raw = checker.getTypeOfSymbolAtLocation(param, decl);
  const type = isOptional ? stripUndefinedFromType(raw, checker) : raw;
  const arms = objectArms(type, checker);
  if (arms.length === 0) return schema;

  const props = resolvedProperties(type, checker);
  const resolved = buildObjectSchema(props, checker, ctx, type) as Record<string, unknown>;
  if (arms.length > 1) {
    const perArm = arms.map((arm) => armRequiredNames(arm, checker));
    // Required only when every arm requires it.
    const requiredInAll = new Set(
      props.map((p) => p.getName()).filter((name) => perArm.every((set) => set.has(name))),
    );
    // Property order, not arm order: `resolved.required` follows `props`.
    const required = props.map((p) => p.getName()).filter((n) => requiredInAll.has(n));
    if (required.length) resolved.required = required;
    else delete resolved.required;

    const emitted = new Set(Object.keys(resolved.properties as Record<string, unknown>));
    const anyOf = perArmRequired(perArm, requiredInAll, emitted);
    if (anyOf) resolved.anyOf = anyOf;
  }
  resolved['x-ts-type'] = renderTypeText(type, checker, decl);
  return resolved as SpecSchema;
}

/**
 * The `anyOf` arms for a union's per-arm requiredness, or nothing when the
 * constraint would not bind: an arm that requires nothing beyond `shared`
 * satisfies `anyOf` on its own, and identical arms collapse to one.
 */
function perArmRequired(
  perArm: Set<string>[],
  shared: Set<string>,
  emitted: Set<string>,
): Array<{ required: string[] }> | undefined {
  const distinct = new Map<string, string[]>();
  for (const set of perArm) {
    const extra = [...set].filter((name) => emitted.has(name) && !shared.has(name));
    if (extra.length === 0) return undefined;
    distinct.set(extra.join('\0'), extra);
  }
  if (distinct.size < 2) return undefined;
  return [...distinct.values()].map((required) => ({ required }));
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
