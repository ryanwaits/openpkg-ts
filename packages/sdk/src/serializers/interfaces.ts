import type { SpecExport, SpecMember, SpecSignature } from '@openpkg-ts/spec';
import ts from 'typescript';
import {
  extractTypeParameters,
  extractTypeParametersFromSignature,
  getJSDocComment,
  getJSDocForSignature,
  getSourceLocation,
  isSymbolDeprecated,
} from '../ast/utils';
import { extractParameters, registerReferencedTypes } from '../types/parameters';
import { buildSchema } from '../types/schema-builder';
import type { SerializerContext } from './context';

export function serializeInterface(
  node: ts.InterfaceDeclaration,
  ctx: SerializerContext,
): SpecExport | null {
  const { typeChecker: checker } = ctx;
  const symbol = checker.getSymbolAtLocation(node.name ?? node);
  const name = symbol?.getName() ?? node.name?.getText();
  if (!name) return null;

  const deprecated = isSymbolDeprecated(symbol);
  const declSourceFile = node.getSourceFile();
  const { description, tags, examples } = getJSDocComment(node, symbol, checker);
  const source = getSourceLocation(node, declSourceFile);

  // Extract type parameters like <T, K extends Base>
  const typeParameters = extractTypeParameters(node, checker);

  // Extract members: properties, methods, call signatures
  const members: SpecMember[] = [];
  const methodsByName = new Map<string, SpecMember>();
  // Aggregate call signatures (overloads) into a single member
  let callSignatureMember: SpecMember | null = null;

  for (const member of node.members) {
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

  // Extract extends clause
  const extendsClause = getInterfaceExtends(node, checker);

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
    ...(deprecated ? { deprecated: true } : {}),
    ...(examples.length > 0 ? { examples } : {}),
  };
}

function serializePropertySignature(
  node: ts.PropertySignature,
  ctx: SerializerContext,
): SpecMember | null {
  const { typeChecker: checker } = ctx;
  const name = node.name.getText();

  const { description, tags } = getJSDocComment(node);

  const type = checker.getTypeAtLocation(node);
  const schema = buildSchema(type, checker, ctx);
  registerReferencedTypes(type, ctx);

  const flags: Record<string, unknown> = {};
  if (node.questionToken) flags.optional = true;
  if (node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ReadonlyKeyword)) {
    flags.readonly = true;
  }

  return {
    name,
    kind: 'property',
    description,
    tags: tags.length > 0 ? tags : undefined,
    schema,
    flags: Object.keys(flags).length > 0 ? flags : undefined,
  };
}

function serializeMethodSignature(
  node: ts.MethodSignature,
  ctx: SerializerContext,
): SpecMember | null {
  const { typeChecker: checker } = ctx;
  const name = node.name.getText();

  const { description, tags } = getJSDocComment(node);

  const type = checker.getTypeAtLocation(node);
  const callSignatures = type.getCallSignatures();

  const signatures: SpecSignature[] = callSignatures.map((sig, index) => {
    const params = extractParameters(sig, ctx);
    const returnType = checker.getReturnTypeOfSignature(sig);
    registerReferencedTypes(returnType, ctx);

    // Get per-overload JSDoc
    const sigDoc = getJSDocForSignature(sig, checker);

    // Get per-overload type parameters
    const sigTypeParams = extractTypeParametersFromSignature(sig, checker);

    return {
      parameters: params.length > 0 ? params : undefined,
      returns: {
        schema: buildSchema(returnType, checker, ctx),
      },
      ...(sigDoc.description ? { description: sigDoc.description } : {}),
      ...(sigDoc.tags.length > 0 ? { tags: sigDoc.tags } : {}),
      ...(sigDoc.examples.length > 0 ? { examples: sigDoc.examples } : {}),
      ...(sigTypeParams ? { typeParameters: sigTypeParams } : {}),
      ...(callSignatures.length > 1 ? { overloadIndex: index } : {}),
    };
  });

  const flags: Record<string, unknown> = {};
  if (node.questionToken) flags.optional = true;

  return {
    name,
    kind: 'method',
    description,
    tags: tags.length > 0 ? tags : undefined,
    signatures: signatures.length > 0 ? signatures : undefined,
    flags: Object.keys(flags).length > 0 ? flags : undefined,
  };
}

function serializeCallSignature(
  node: ts.CallSignatureDeclaration,
  ctx: SerializerContext,
): SpecMember | null {
  const { typeChecker: checker } = ctx;
  const { description, tags } = getJSDocComment(node);

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
    signatures: [
      {
        parameters: params.length > 0 ? params : undefined,
        returns: {
          schema: buildSchema(returnType, checker, ctx),
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
  const { description, tags } = getJSDocComment(node);

  // Get the value type
  const valueType = node.type ? checker.getTypeAtLocation(node.type) : checker.getAnyType();
  const valueSchema = buildSchema(valueType, checker, ctx);
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
  };
}

function getInterfaceExtends(
  node: ts.InterfaceDeclaration,
  checker: ts.TypeChecker,
): string | undefined {
  if (!node.heritageClauses) return undefined;

  for (const clause of node.heritageClauses) {
    if (clause.token === ts.SyntaxKind.ExtendsKeyword && clause.types.length > 0) {
      const names = clause.types.map((expr) => {
        const type = checker.getTypeAtLocation(expr);
        return type.getSymbol()?.getName() ?? expr.expression.getText();
      });
      // Join multiple extends with ' & ' for intersection representation
      return names.join(' & ');
    }
  }
  return undefined;
}
