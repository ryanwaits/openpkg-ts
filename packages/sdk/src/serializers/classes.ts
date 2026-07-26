import type { SpecExport, SpecMember, SpecSignature, SpecVisibility } from '@openpkg-ts/spec';
import ts from 'typescript';
import { extractTypeParameters, getJSDocComment, isSymbolDeprecated } from '../ast/utils';
import { extractParameters, registerReferencedTypes } from '../types/parameters';
import {
  buildSchema,
  decoratePropertySchema,
  stripUndefinedFromType,
} from '../types/schema-builder';
import { getInheritedMembers, type SerializerContext } from './context';
import { buildSignatures, extractExportMetadata } from './shared';

export function serializeClass(
  node: ts.ClassDeclaration,
  ctx: SerializerContext,
): SpecExport | null {
  const { typeChecker: checker } = ctx;
  const symbol = checker.getSymbolAtLocation(node.name ?? node);
  const name = symbol?.getName() ?? node.name?.getText();
  if (!name) return null;

  const { description, tags, examples, source, deprecated, deprecationReason, inlineTags } =
    extractExportMetadata(node, symbol, checker);

  // Extract type parameters like <T, K extends Base>
  const typeParameters = extractTypeParameters(node, checker);

  // Extract members: properties, methods, constructor
  const members: SpecMember[] = [];
  const signatures: SpecSignature[] = [];
  const methodsByName = new Map<string, SpecMember>();

  for (const member of node.members) {
    // Skip private members (start with #)
    const memberName = getMemberName(member);
    if (memberName?.startsWith('#')) continue;

    if (ts.isPropertyDeclaration(member)) {
      const propMember = serializeProperty(member, ctx);
      if (propMember) members.push(propMember);
    } else if (ts.isMethodDeclaration(member)) {
      const methodMember = serializeMethod(member, ctx);
      if (methodMember?.name) {
        // Dedupe methods by name - only first declaration captures all overloads
        if (!methodsByName.has(methodMember.name)) {
          methodsByName.set(methodMember.name, methodMember);
        } else {
          // Keep first description/tags if missing
          const existing = methodsByName.get(methodMember.name);
          if (!existing) continue;
          if (!existing.description && methodMember.description) {
            existing.description = methodMember.description;
          }
          if (!existing.tags && methodMember.tags) {
            existing.tags = methodMember.tags;
          }
        }
      }
    } else if (ts.isConstructorDeclaration(member)) {
      const ctorSig = serializeConstructor(member, ctx);
      if (ctorSig) signatures.push(ctorSig);
    } else if (ts.isGetAccessorDeclaration(member) || ts.isSetAccessorDeclaration(member)) {
      const accessorMember = serializeAccessor(member, ctx);
      if (accessorMember) members.push(accessorMember);
    }
  }

  // Add deduplicated methods
  members.push(...methodsByName.values());

  // No own constructor: surface inherited construct signatures from the base chain
  if (signatures.length === 0) {
    signatures.push(...serializeInheritedConstructors(node, ctx));
  }

  // Collect own member names for inheritance filtering
  const ownMemberNames = new Set<string>();
  for (const member of node.members) {
    const memberName = getMemberName(member);
    if (memberName) ownMemberNames.add(memberName);
  }

  // Get class type for inheritance analysis
  const classType = checker.getTypeAtLocation(node);

  // Get inherited instance members
  const inheritedInstance = getInheritedMembers(classType, ownMemberNames, ctx, false);
  members.push(...inheritedInstance);

  // Get inherited static members
  const inheritedStatic = getInheritedMembers(classType, ownMemberNames, ctx, true);
  members.push(...inheritedStatic);

  // Extract extends clause
  const extendsClause = getExtendsClause(node, checker);

  // Extract implements clause
  const implementsClause = getImplementsClause(node, checker);

  // Check for class-level flags (abstract class)
  const classFlags: Record<string, unknown> = {};
  const classModifiers = ts.getModifiers(node);
  if (classModifiers?.some((m) => m.kind === ts.SyntaxKind.AbstractKeyword)) {
    classFlags.abstract = true;
  }

  return {
    id: name,
    name,
    kind: 'class',
    description,
    tags,
    source,
    typeParameters,
    members: members.length > 0 ? members : undefined,
    signatures: signatures.length > 0 ? signatures : undefined,
    extends: extendsClause,
    implements: implementsClause?.length ? implementsClause : undefined,
    ...(deprecated ? { deprecated: true, deprecationReason } : {}),
    ...(examples.length > 0 ? { examples } : {}),
    ...(inlineTags ? { inlineTags } : {}),
    ...(Object.keys(classFlags).length > 0 ? { flags: classFlags } : {}),
  };
}

function getMemberName(member: ts.ClassElement): string | undefined {
  if (ts.isConstructorDeclaration(member)) return 'constructor';
  if (!member.name) return undefined;
  if (ts.isIdentifier(member.name)) return member.name.text;
  if (ts.isPrivateIdentifier(member.name)) return member.name.text;
  return member.name.getText();
}

function getVisibility(member: ts.ClassElement): SpecVisibility | undefined {
  const modifiers = ts.canHaveModifiers(member) ? ts.getModifiers(member) : undefined;
  if (!modifiers) return undefined;

  for (const mod of modifiers) {
    if (mod.kind === ts.SyntaxKind.PrivateKeyword) return 'private';
    if (mod.kind === ts.SyntaxKind.ProtectedKeyword) return 'protected';
    if (mod.kind === ts.SyntaxKind.PublicKeyword) return 'public';
  }
  return undefined;
}

function isStatic(member: ts.ClassElement): boolean {
  const modifiers = ts.canHaveModifiers(member) ? ts.getModifiers(member) : undefined;
  return modifiers?.some((m) => m.kind === ts.SyntaxKind.StaticKeyword) ?? false;
}

function isReadonly(member: ts.ClassElement): boolean {
  const modifiers = ts.canHaveModifiers(member) ? ts.getModifiers(member) : undefined;
  return modifiers?.some((m) => m.kind === ts.SyntaxKind.ReadonlyKeyword) ?? false;
}

function serializeProperty(
  node: ts.PropertyDeclaration,
  ctx: SerializerContext,
): SpecMember | null {
  const { typeChecker: checker } = ctx;
  const name = getMemberName(node);
  if (!name) return null;

  const { description, tags, inlineTags } = getJSDocComment(node);
  const visibility = getVisibility(node);

  // Skip private/protected members unless includePrivate is set
  if (!ctx.includePrivate && (visibility === 'private' || visibility === 'protected')) {
    return null;
  }

  // Get property type — optional members strip undefined (optionality is
  // carried by flags.optional / required omission, not a null branch)
  const rawType = checker.getTypeAtLocation(node);
  const type = node.questionToken ? stripUndefinedFromType(rawType, checker) : rawType;

  // Register referenced types FIRST (before buildSchema adds to visitedTypes)
  registerReferencedTypes(type, ctx);

  // Then build the schema
  let schema = buildSchema(type, checker, ctx);

  const flags: Record<string, unknown> = {};
  if (isStatic(node)) flags.static = true;
  if (isReadonly(node)) flags.readonly = true;
  if (node.questionToken) flags.optional = true;

  const symbol = checker.getSymbolAtLocation(node.name ?? node);
  if (symbol) {
    schema = decoratePropertySchema(schema, symbol, type, checker);
  }
  const { deprecated, reason: deprecationReason } = isSymbolDeprecated(symbol);

  return {
    name,
    kind: 'property',
    description,
    tags: tags.length > 0 ? tags : undefined,
    visibility,
    schema,
    flags: Object.keys(flags).length > 0 ? flags : undefined,
    ...(inlineTags ? { inlineTags } : {}),
    ...(deprecated ? { deprecated: true, deprecationReason } : {}),
  };
}

function serializeMethod(node: ts.MethodDeclaration, ctx: SerializerContext): SpecMember | null {
  const { typeChecker: checker } = ctx;
  const name = getMemberName(node);
  if (!name) return null;

  const { description, tags, inlineTags } = getJSDocComment(node);
  const visibility = getVisibility(node);

  // Skip private/protected members unless includePrivate is set
  if (!ctx.includePrivate && (visibility === 'private' || visibility === 'protected')) {
    return null;
  }

  // Get method signatures
  const type = checker.getTypeAtLocation(node);
  const callSignatures = type.getCallSignatures();

  const signatures = buildSignatures(callSignatures, checker, ctx);

  const flags: Record<string, unknown> = {};
  if (isStatic(node)) flags.static = true;
  if (node.asteriskToken) flags.generator = true;
  // Declaration form: method syntax vs function-typed property.
  flags.methodSyntax = true;

  // Check for async and abstract
  const modifiers = ts.getModifiers(node);
  if (modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword)) {
    flags.async = true;
  }
  if (modifiers?.some((m) => m.kind === ts.SyntaxKind.AbstractKeyword)) {
    flags.abstract = true;
  }

  const symbol = checker.getSymbolAtLocation(node.name ?? node);
  const { deprecated, reason: deprecationReason } = isSymbolDeprecated(symbol);

  // Signature-carrying members get a synthetic function schema so the
  // checker-rendered type text is available at the member level too.
  const schema = symbol
    ? decoratePropertySchema({ 'x-ts-function': true }, symbol, type, checker)
    : undefined;

  return {
    name,
    kind: 'method',
    description,
    tags: tags.length > 0 ? tags : undefined,
    visibility,
    schema,
    signatures: signatures.length > 0 ? signatures : undefined,
    flags: Object.keys(flags).length > 0 ? flags : undefined,
    ...(inlineTags ? { inlineTags } : {}),
    ...(deprecated ? { deprecated: true, deprecationReason } : {}),
  };
}

function serializeConstructor(
  node: ts.ConstructorDeclaration,
  ctx: SerializerContext,
): SpecSignature | null {
  const { typeChecker: checker } = ctx;

  const sig = checker.getSignatureFromDeclaration(node);
  if (!sig) return null;

  return serializeConstructorSignature(node, sig, ctx);
}

function serializeConstructorSignature(
  node: ts.ConstructorDeclaration,
  sig: ts.Signature,
  ctx: SerializerContext,
): SpecSignature {
  const { description, tags, examples, inlineTags } = getJSDocComment(node);
  const params = extractParameters(sig, ctx);

  return {
    description,
    parameters: params.length > 0 ? params : undefined,
    ...(tags.length > 0 ? { tags } : {}),
    ...(examples.length > 0 ? { examples } : {}),
    ...(inlineTags ? { inlineTags } : {}),
  };
}

/**
 * Resolve constructor signatures inherited from a base class when the class
 * declares none of its own. Only signatures backed by a real constructor
 * declaration are serialized — a default synthesized constructor has none.
 */
function serializeInheritedConstructors(
  node: ts.ClassDeclaration,
  ctx: SerializerContext,
): SpecSignature[] {
  const { typeChecker: checker } = ctx;
  const hasExtends = node.heritageClauses?.some((c) => c.token === ts.SyntaxKind.ExtendsKeyword);
  if (!hasExtends) return [];

  const symbol = checker.getSymbolAtLocation(node.name ?? node);
  if (!symbol) return [];

  // The static side of the class carries construct signatures, including inherited ones
  const staticType = checker.getTypeOfSymbolAtLocation(symbol, node);
  const ctorSigs = staticType.getConstructSignatures().filter((sig) => {
    const decl = sig.getDeclaration();
    return decl !== undefined && ts.isConstructorDeclaration(decl);
  });

  return ctorSigs.map((sig, index) => {
    const decl = sig.getDeclaration() as ts.ConstructorDeclaration;
    const owner = ts.isClassLike(decl.parent) ? decl.parent.name?.text : undefined;

    return {
      ...serializeConstructorSignature(decl, sig, ctx),
      ...(owner ? { inheritedFrom: owner } : {}),
      ...(ctorSigs.length > 1 ? { overloadIndex: index } : {}),
    };
  });
}

function serializeAccessor(
  node: ts.GetAccessorDeclaration | ts.SetAccessorDeclaration,
  ctx: SerializerContext,
): SpecMember | null {
  const { typeChecker: checker } = ctx;
  const name = getMemberName(node);
  if (!name) return null;

  const { description, tags, inlineTags } = getJSDocComment(node);
  const visibility = getVisibility(node);

  // Skip private/protected members unless includePrivate is set
  if (!ctx.includePrivate && (visibility === 'private' || visibility === 'protected')) {
    return null;
  }

  const type = checker.getTypeAtLocation(node);
  const schema = buildSchema(type, checker, ctx);
  registerReferencedTypes(type, ctx);

  const kind = ts.isGetAccessorDeclaration(node) ? 'getter' : 'setter';

  const flags: Record<string, unknown> = {};
  if (isStatic(node)) flags.static = true;

  // For setters, extract parameter info into signatures array
  let signatures: SpecSignature[] | undefined;
  if (ts.isSetAccessorDeclaration(node) && node.parameters.length > 0) {
    const param = node.parameters[0];
    const paramName = param.name.getText();
    const paramType = checker.getTypeAtLocation(param);
    registerReferencedTypes(paramType, ctx);

    signatures = [
      {
        parameters: [
          {
            name: paramName,
            schema: buildSchema(paramType, checker, ctx),
            required: true,
          },
        ],
      },
    ];
  }

  return {
    name,
    kind,
    description,
    tags: tags.length > 0 ? tags : undefined,
    visibility,
    schema,
    signatures,
    flags: Object.keys(flags).length > 0 ? flags : undefined,
    ...(inlineTags ? { inlineTags } : {}),
  };
}

function getExtendsClause(node: ts.ClassDeclaration, checker: ts.TypeChecker): string | undefined {
  if (!node.heritageClauses) return undefined;

  for (const clause of node.heritageClauses) {
    if (clause.token === ts.SyntaxKind.ExtendsKeyword) {
      const expr = clause.types[0];
      if (expr) {
        const type = checker.getTypeAtLocation(expr);
        const symbol = type.getSymbol();
        return symbol?.getName() ?? expr.expression.getText();
      }
    }
  }
  return undefined;
}

function getImplementsClause(
  node: ts.ClassDeclaration,
  checker: ts.TypeChecker,
): string[] | undefined {
  if (!node.heritageClauses) return undefined;

  for (const clause of node.heritageClauses) {
    if (clause.token === ts.SyntaxKind.ImplementsKeyword) {
      return clause.types.map((expr) => {
        const type = checker.getTypeAtLocation(expr);
        const symbol = type.getSymbol();
        return symbol?.getName() ?? expr.expression.getText();
      });
    }
  }
  return undefined;
}
