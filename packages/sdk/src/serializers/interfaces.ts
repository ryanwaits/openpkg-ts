import type { SpecExport, SpecMember, SpecSignature } from '@openpkg-ts/spec';
import ts from 'typescript';
import {
  extractTypeParameters,
  getExtendsText,
  getJSDocComment,
  isSymbolDeprecated,
} from '../ast/utils';
import { extractParameters, registerReferencedTypes } from '../types/parameters';
import {
  buildSchema,
  decoratePropertySchema,
  openHeritageArms,
  stripUndefinedFromType,
} from '../types/schema-builder';
import { getInheritedMembers, type SerializerContext } from './context';
import { buildSignatures, extractExportMetadata } from './shared';

export function serializeInterface(
  node: ts.InterfaceDeclaration,
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

  const { members, callSignatureMember } = serializeTypeElements(node.members, ctx);

  // Extract extends clause
  const extendsClause = getExtendsText(node, checker);
  const openArms = openHeritageArms([node], checker, ctx);

  // For callable interfaces, extract call signatures to export-level signatures array
  // This makes it easier for consumers to know the interface is callable
  const exportSignatures: SpecSignature[] | undefined =
    callSignatureMember?.signatures && callSignatureMember.signatures.length > 0
      ? callSignatureMember.signatures
      : undefined;

  return {
    id: name,
    name,
    kind: 'interface',
    description,
    tags,
    source,
    typeParameters,
    members: members.length > 0 ? members : undefined,
    signatures: exportSignatures,
    extends: extendsClause,
    // Arms only: normalizeExport joins them to the shape it builds from members.
    ...(openArms.length > 0 ? { schema: { allOf: openArms } } : {}),
    ...(deprecated ? { deprecated: true, deprecationReason } : {}),
    ...(examples.length > 0 ? { examples } : {}),
    ...(inlineTags ? { inlineTags } : {}),
  };
}

/**
 * Members of an interface body or type literal: properties, methods (overloads
 * merged by name), call signatures (aggregated into one member), index signatures.
 */
function serializeTypeElements(
  elements: readonly ts.TypeElement[],
  ctx: SerializerContext,
): { members: SpecMember[]; callSignatureMember: SpecMember | null } {
  const members: SpecMember[] = [];
  const methodsByName = new Map<string, SpecMember>();
  // Aggregate call signatures (overloads) into a single member
  let callSignatureMember: SpecMember | null = null;

  for (const member of elements) {
    if (ts.isPropertySignature(member)) {
      const propMember = serializePropertySignature(member, ctx);
      if (propMember) members.push(propMember);
    } else if (ts.isMethodSignature(member)) {
      const methodMember = serializeMethodSignature(member, ctx);
      if (methodMember?.name && methodMember.signatures) {
        // Merge method overloads by name
        const existing = methodsByName.get(methodMember.name);
        if (existing?.signatures) {
          // Add overload index to merged signatures
          const startIndex = existing.signatures.length;
          const newSigs = methodMember.signatures.map((sig, i) => ({
            ...sig,
            overloadIndex: startIndex + i,
          }));
          // Also add overload index to existing signatures if not present
          if (
            existing.signatures.length > 0 &&
            existing.signatures[0].overloadIndex === undefined
          ) {
            existing.signatures = existing.signatures.map((sig, i) => ({
              ...sig,
              overloadIndex: i,
            }));
          }
          existing.signatures.push(...newSigs);
        } else {
          methodsByName.set(methodMember.name, methodMember);
        }
      }
    } else if (ts.isCallSignatureDeclaration(member)) {
      // Callable interface: interface Foo { (): void; (arg: T): string }
      // Aggregate all call signatures into a single member with multiple signatures
      const callSig = serializeCallSignature(member, ctx);
      if (callSig?.signatures) {
        if (callSignatureMember?.signatures) {
          // Add overload index to merged signatures
          const startIndex = callSignatureMember.signatures.length;
          const newSigs = callSig.signatures.map((sig, i) => ({
            ...sig,
            overloadIndex: startIndex + i,
          }));
          // Also add overload index to existing signatures if not present
          if (
            callSignatureMember.signatures.length > 0 &&
            callSignatureMember.signatures[0].overloadIndex === undefined
          ) {
            callSignatureMember.signatures = callSignatureMember.signatures.map((sig, i) => ({
              ...sig,
              overloadIndex: i,
            }));
          }
          callSignatureMember.signatures.push(...newSigs);
          // Merge descriptions if both exist
          if (callSig.description && !callSignatureMember.description) {
            callSignatureMember.description = callSig.description;
          }
        } else {
          callSignatureMember = callSig;
        }
      }
    } else if (ts.isIndexSignatureDeclaration(member)) {
      // Index signature: interface Foo { [key: string]: number }
      const indexMember = serializeIndexSignature(member, ctx);
      if (indexMember) members.push(indexMember);
    }
  }

  // Add aggregated call signature member if present
  if (callSignatureMember) {
    members.push(callSignatureMember);
  }

  // Add deduplicated methods with merged overloads
  members.push(...methodsByName.values());

  return { members, callSignatureMember };
}

/**
 * Type side of a name that is also a value (`interface Foo` + `const Foo`, or
 * `type Foo = {...}` + `const Foo`). The value export carries these the way a
 * class carries its instance members: own members of every merged interface
 * declaration (or of the alias's type literal), then members inherited through
 * `extends`. Undefined when the symbol has no such type side.
 */
export function serializeMergedTypeSide(
  symbol: ts.Symbol,
  ctx: SerializerContext,
): Pick<SpecExport, 'members' | 'extends' | 'typeParameters' | 'description' | 'tags'> | undefined {
  const { typeChecker: checker } = ctx;
  const declarations = symbol.declarations ?? [];
  const interfaces = declarations.filter(ts.isInterfaceDeclaration);
  const alias = declarations.find(ts.isTypeAliasDeclaration);
  const typeDecl = interfaces[0] ?? alias;
  if (!typeDecl) return undefined;

  const elements =
    interfaces.length > 0
      ? interfaces.flatMap((decl) => [...decl.members])
      : alias && ts.isTypeLiteralNode(alias.type)
        ? [...alias.type.members]
        : [];
  const { members } = serializeTypeElements(elements, ctx);

  if (interfaces.length > 0) {
    const ownNames = new Set(members.flatMap((m) => (m.name ? [m.name] : [])));
    members.push(
      ...getInheritedMembers(checker.getDeclaredTypeOfSymbol(symbol), ownNames, ctx, false),
    );
  }
  if (members.length === 0) return undefined;

  const { description, tags } = getJSDocComment(typeDecl);
  return {
    members,
    extends: interfaces.map((decl) => getExtendsText(decl, checker)).find(Boolean),
    typeParameters: extractTypeParameters(typeDecl, checker),
    description,
    tags,
  };
}

function serializePropertySignature(
  node: ts.PropertySignature,
  ctx: SerializerContext,
): SpecMember | null {
  const { typeChecker: checker } = ctx;
  const name = node.name.getText();

  const { description, tags, inlineTags } = getJSDocComment(node);

  const rawType = checker.getTypeAtLocation(node);
  // Optional members express optionality via flags.optional / required
  // omission — strip undefined so the schema doesn't admit null
  const type = node.questionToken ? stripUndefinedFromType(rawType, checker) : rawType;
  let schema = buildSchema(type, checker, ctx, node.type);
  registerReferencedTypes(type, ctx);

  const flags: Record<string, unknown> = {};
  if (node.questionToken) flags.optional = true;
  if (node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ReadonlyKeyword)) {
    flags.readonly = true;
  }

  const symbol = checker.getSymbolAtLocation(node.name);
  if (symbol) {
    schema = decoratePropertySchema(schema, symbol, type, checker);
  }
  const { deprecated, reason: deprecationReason } = isSymbolDeprecated(symbol);

  return {
    name,
    kind: 'property',
    description,
    tags: tags.length > 0 ? tags : undefined,
    schema,
    flags: Object.keys(flags).length > 0 ? flags : undefined,
    ...(inlineTags ? { inlineTags } : {}),
    ...(deprecated ? { deprecated: true, deprecationReason } : {}),
  };
}

function serializeMethodSignature(
  node: ts.MethodSignature,
  ctx: SerializerContext,
): SpecMember | null {
  const { typeChecker: checker } = ctx;
  const name = node.name.getText();

  const { description, tags, inlineTags } = getJSDocComment(node);

  // `run?(): void` is typed `(() => void) | undefined`; the union has no call signatures
  const rawType = checker.getTypeAtLocation(node);
  const type = node.questionToken ? stripUndefinedFromType(rawType, checker) : rawType;
  const callSignatures = type.getCallSignatures();

  const signatures = buildSignatures(callSignatures, checker, ctx);

  const flags: Record<string, unknown> = {};
  if (node.questionToken) flags.optional = true;
  // Declaration form: method syntax vs function-typed property (GAP-visible
  // on mapped members where SymbolFlags.Method is stripped).
  flags.methodSyntax = true;

  const symbol = checker.getSymbolAtLocation(node.name);
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
    schema,
    signatures: signatures.length > 0 ? signatures : undefined,
    flags: Object.keys(flags).length > 0 ? flags : undefined,
    ...(inlineTags ? { inlineTags } : {}),
    ...(deprecated ? { deprecated: true, deprecationReason } : {}),
  };
}

function serializeCallSignature(
  node: ts.CallSignatureDeclaration,
  ctx: SerializerContext,
): SpecMember | null {
  const { typeChecker: checker } = ctx;
  const { description, tags, inlineTags } = getJSDocComment(node);

  const sig = checker.getSignatureFromDeclaration(node);
  if (!sig) return null;

  const params = extractParameters(sig, ctx);
  const returnType = checker.getReturnTypeOfSignature(sig);
  registerReferencedTypes(returnType, ctx);

  return {
    name: '()',
    kind: 'call-signature',
    description,
    tags: tags.length > 0 ? tags : undefined,
    ...(inlineTags ? { inlineTags } : {}),
    signatures: [
      {
        parameters: params.length > 0 ? params : undefined,
        returns: {
          schema: buildSchema(returnType, checker, ctx, node.type),
        },
      },
    ],
  };
}

function serializeIndexSignature(
  node: ts.IndexSignatureDeclaration,
  ctx: SerializerContext,
): SpecMember | null {
  const { typeChecker: checker } = ctx;
  const { description, tags, inlineTags } = getJSDocComment(node);

  // Get the value type
  const valueType = node.type ? checker.getTypeAtLocation(node.type) : checker.getAnyType();
  const valueSchema = buildSchema(valueType, checker, ctx, node.type);
  registerReferencedTypes(valueType, ctx);

  // Get the key type (usually string or number)
  const keyParam = node.parameters[0];
  const keyType = keyParam?.type
    ? checker.getTypeAtLocation(keyParam.type)
    : checker.getStringType();
  const keyTypeName = checker.typeToString(keyType);

  // The member represents "what type do values have" - just the value schema
  // The parent interface schema will use additionalProperties for the full object
  return {
    name: `[${keyTypeName}]`,
    kind: 'index-signature',
    description,
    tags: tags.length > 0 ? tags : undefined,
    schema: valueSchema,
    ...(inlineTags ? { inlineTags } : {}),
  };
}
