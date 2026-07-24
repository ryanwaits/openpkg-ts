import type { SpecExport, SpecMember, SpecSchema } from '@openpkg-ts/spec';
import ts from 'typescript';
import { extractTypeParameters, getJSDocComment, isSymbolDeprecated } from '../ast/utils';
import { registerReferencedTypes } from '../types/parameters';
import {
  buildFunctionSchema,
  buildObjectSchema,
  buildSchema,
  decoratePropertySchema,
  isBuiltinSymbol,
  isReadonlyPropertySymbol,
  PRIMITIVES,
  renderTypeText,
  shouldEmitAliasTypeText,
} from '../types/schema-builder';
import type { SerializerContext } from './context';
import { buildSignatures, extractExportMetadata } from './shared';

/**
 * Build schema from an intersection type node, preserving structure as allOf.
 * This is used to maintain the original intersection structure instead of
 * letting TypeScript flatten it into an object type.
 */
function buildIntersectionSchemaFromNode(
  node: ts.IntersectionTypeNode,
  ctx: SerializerContext,
): SpecSchema {
  const types = node.types;
  const schemas: SpecSchema[] = [];

  for (const typeNode of types) {
    const type = ctx.typeChecker.getTypeAtLocation(typeNode);
    registerReferencedTypes(type, ctx);
    schemas.push(buildSchema(type, ctx.typeChecker, ctx));
  }

  // Handle degenerate cases
  if (schemas.length === 0) {
    return { type: 'never' };
  }
  if (schemas.length === 1) {
    return schemas[0];
  }

  return { allOf: schemas };
}

export function serializeTypeAlias(
  node: ts.TypeAliasDeclaration,
  ctx: SerializerContext,
): SpecExport | null {
  const symbol = ctx.typeChecker.getSymbolAtLocation(node.name ?? node);
  const name = symbol?.getName() ?? node.name?.getText();
  if (!name) return null;

  const { description, tags, examples, source, deprecated, deprecationReason } =
    extractExportMetadata(node, symbol, ctx.typeChecker);

  // Extract type parameters like <T, K extends Base>
  const typeParameters = extractTypeParameters(node, ctx.typeChecker);

  const type = ctx.typeChecker.getTypeAtLocation(node);

  // Register referenced types FIRST (before buildSchema adds to visitedTypes)
  registerReferencedTypes(type, ctx);

  // Check if this is an intersection type node - preserve structure
  let schema: SpecSchema;
  let members: SpecMember[] | undefined;
  if (ts.isIntersectionTypeNode(node.type)) {
    schema = buildIntersectionSchemaFromNode(node.type, ctx);
    // Parity with mapped/conditional aliases: the allOf shell keeps the
    // intersection structure, but consumers still get resolved members with
    // per-property docs (Config = Omit<Base,'loaded'> & {…}).
    if (type.getProperties().length > 0 && type.getCallSignatures().length === 0) {
      members = serializeResolvedMembers(type, node, ctx);
    }
  } else if (isInlineFunctionAlias(node.type) && type.getCallSignatures().length > 0) {
    // `type CallFn = (...) => R` (or callable literal): buildSchema at the top level
    // would short-circuit to a self-$ref; build the function schema from the
    // resolved call signatures instead.
    schema = buildFunctionSchema(type.getCallSignatures(), ctx.typeChecker, ctx);
  } else if (
    (ts.isMappedTypeNode(node.type) || ts.isConditionalTypeNode(node.type)) &&
    type.getProperties().length > 0 &&
    type.getCallSignatures().length === 0
  ) {
    // Mapped/conditional aliases (`{[K in keyof SDK]: ...}`) have no syntax members;
    // flatten via the checker so consumers see the resolved properties.
    schema = buildObjectSchema(type.getProperties(), ctx.typeChecker, ctx, type);
    members = serializeResolvedMembers(type, node, ctx);
  } else {
    // Then build the schema normally
    schema = buildSchema(type, ctx.typeChecker, ctx);
    // Object-shaped aliases beyond intersections/mapped — object literals,
    // utility instantiations (Pick/Omit), cross-package references — also get
    // the JSDoc-rich members layer (descriptions, tags, flags).
    if (isObjectShapedAlias(type, ctx)) {
      members = serializeResolvedMembers(type, node, ctx);
    }
  }

  // Alias-level x-ts-type: renderable RHS text ("Item[]", "Generic<A, B>")
  // for aliases whose structural schema carries no display text.
  if (
    shouldEmitAliasTypeText(node.type) &&
    typeof schema === 'object' &&
    schema !== null &&
    !('x-ts-type' in schema)
  ) {
    const text = renderTypeText(type, ctx.typeChecker, node, ts.TypeFormatFlags.InTypeAlias);
    if (!PRIMITIVES.has(text) && text !== name) {
      (schema as Record<string, unknown>)['x-ts-type'] = text;
    }
  }

  return {
    id: name,
    name,
    kind: 'type',
    description,
    tags,
    source,
    typeParameters,
    schema,
    ...(members && members.length > 0 ? { members } : {}),
    ...(deprecated ? { deprecated: true, deprecationReason } : {}),
    ...(examples.length > 0 ? { examples } : {}),
  };
}

/**
 * Object-shaped alias check for the members layer: has resolved properties,
 * no call signatures, and isn't an array/tuple (whose "properties" are
 * prototype methods) or a TS-lib builtin (Promise, Date, …).
 */
function isObjectShapedAlias(type: ts.Type, ctx: SerializerContext): boolean {
  const { typeChecker: checker } = ctx;
  if (!(type.flags & ts.TypeFlags.Object)) return false;
  if (checker.isArrayType(type) || checker.isTupleType(type)) return false;
  // Mapped instantiations (Pick/Omit/Partial) carry the lib mapped-type node
  // as their symbol but their members come from user code — never builtin.
  const objectFlags = (type as ts.ObjectType).objectFlags;
  if (!(objectFlags & ts.ObjectFlags.Mapped)) {
    const targetSymbol = (type as ts.TypeReference).target?.getSymbol?.() ?? type.getSymbol();
    // Builtins (Promise, Date, …) would surface lib prototype methods as members.
    if (isBuiltinSymbol(targetSymbol)) return false;
  }
  return type.getProperties().length > 0 && type.getCallSignatures().length === 0;
}

/** Syntax check: alias body is an inline function type or a callable type literal. */
function isInlineFunctionAlias(typeNode: ts.TypeNode): boolean {
  return (
    ts.isFunctionTypeNode(typeNode) ||
    (ts.isTypeLiteralNode(typeNode) && typeNode.members.some(ts.isCallSignatureDeclaration))
  );
}

interface ArmDoc {
  deprecated: boolean;
  deprecationReason?: string;
  description?: string;
}

/**
 * Walk a mapped type's conditional template (`K extends "a" | "b" ? Arm : ...`)
 * and map literal key names to the JSDoc of the arm's alias. The checker erases
 * alias identity when instantiating conditionals, so this is syntax-only —
 * it's how `@deprecated` on an intermediate alias (`type RunSnippet = SDK["runSnippet"]`)
 * reaches the mapped member.
 */
function buildConditionalArmDocs(
  typeNode: ts.TypeNode,
  checker: ts.TypeChecker,
): Map<string, ArmDoc> {
  const docs = new Map<string, ArmDoc>();
  if (!ts.isMappedTypeNode(typeNode) || !typeNode.type) return docs;

  const literalKeys = (extendsType: ts.TypeNode): string[] => {
    const keys: string[] = [];
    const visit = (n: ts.TypeNode) => {
      if (ts.isUnionTypeNode(n)) {
        for (const member of n.types) visit(member);
      } else if (ts.isLiteralTypeNode(n) && ts.isStringLiteral(n.literal)) {
        keys.push(n.literal.text);
      }
    };
    visit(extendsType);
    return keys;
  };

  const armDoc = (armType: ts.TypeNode): ArmDoc | undefined => {
    if (!ts.isTypeReferenceNode(armType)) return undefined;
    const symbol = checker.getSymbolAtLocation(armType.typeName);
    if (!symbol) return undefined;
    const target = symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
    const { deprecated, reason } = isSymbolDeprecated(target);
    const targetDecl = target.getDeclarations()?.[0];
    const description = targetDecl
      ? getJSDocComment(targetDecl, target, checker).description
      : undefined;
    if (!deprecated && !description) return undefined;
    return { deprecated, deprecationReason: reason, description };
  };

  let current: ts.TypeNode | undefined = typeNode.type;
  while (current && ts.isConditionalTypeNode(current)) {
    const doc = armDoc(current.trueType);
    if (doc) {
      for (const key of literalKeys(current.extendsType)) {
        if (!docs.has(key)) docs.set(key, doc);
      }
    }
    current = current.falseType;
  }
  return docs;
}

/**
 * Serialize the checker-resolved properties of a mapped/conditional type alias
 * into members. JSDoc and @deprecated are read from the property symbol first,
 * then from the conditional arm's alias (e.g. `K extends "runSnippet" ?
 * RunSnippet : ...` where the @deprecated lives on `RunSnippet`).
 */
function serializeResolvedMembers(
  type: ts.Type,
  node: ts.TypeAliasDeclaration,
  ctx: SerializerContext,
): SpecMember[] {
  const { typeChecker: checker } = ctx;
  const members: SpecMember[] = [];
  const armDocs = buildConditionalArmDocs(node.type, checker);

  for (const prop of type.getProperties()) {
    const decl = prop.getDeclarations()?.[0] ?? node;
    const propType = checker.getTypeOfSymbolAtLocation(prop, decl);
    registerReferencedTypes(propType, ctx);

    const callSigs = propType.getCallSignatures();
    // Match serializeInterface: classification follows declaration syntax.
    // `loaded: (ph) => void` is a property with a function type, not a method.
    const isMethodDecl =
      ts.isMethodSignature(decl) || ts.isMethodDeclaration(decl) || ts.isFunctionDeclaration(decl);
    const kind = callSigs.length > 0 && isMethodDecl ? 'method' : 'property';

    let { description, tags } = getJSDocComment(decl, prop, checker);
    let { deprecated, reason: deprecationReason } = isSymbolDeprecated(prop);

    // Fallbacks for docs the checker erased: the arm alias of a conditional
    // template (syntax walk), then the resolved type's alias symbol.
    const arm = armDocs.get(prop.getName());
    if (arm) {
      if (!deprecated && arm.deprecated) {
        deprecated = true;
        deprecationReason = arm.deprecationReason;
      }
      if (!description) description = arm.description;
    }
    const armAlias = propType.aliasSymbol;
    if (!deprecated && armAlias) {
      ({ deprecated, reason: deprecationReason } = isSymbolDeprecated(armAlias));
    }

    const flags: Record<string, unknown> = {};
    if (prop.flags & ts.SymbolFlags.Optional) flags.optional = true;
    if (isReadonlyPropertySymbol(prop)) flags.readonly = true;
    // Declaration form survives on the RESOLVED symbol: method-syntax members
    // keep SymbolFlags.Method, mapped (Omit/Pick) members lose it.
    if (prop.flags & ts.SymbolFlags.Method) flags.methodSyntax = true;

    // Property members decorate their structural schema; signature-carrying
    // members get a synthetic function schema so type text survives there too.
    const schema =
      kind === 'property'
        ? decoratePropertySchema(buildSchema(propType, checker, ctx), prop, propType, checker)
        : decoratePropertySchema({ 'x-ts-function': true }, prop, propType, checker);

    members.push({
      name: prop.getName(),
      kind,
      description,
      tags: tags.length > 0 ? tags : undefined,
      schema,
      signatures: kind === 'method' ? buildSignatures(callSigs, checker, ctx) : undefined,
      flags: Object.keys(flags).length > 0 ? flags : undefined,
      ...(deprecated ? { deprecated: true, deprecationReason } : {}),
    });
  }

  return members;
}
