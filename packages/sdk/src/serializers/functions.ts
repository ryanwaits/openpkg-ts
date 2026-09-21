import type {
  SpecExport,
  SpecSchema,
  SpecSignature,
  SpecSignatureParameter,
  SpecSignatureReturn,
} from '@openpkg-ts/spec';
import ts from 'typescript';
import {
  extractTypeParameters,
  extractTypeParametersFromSignature,
  getJSDocComment,
  getJSDocForSignature,
  getParamDescription,
} from '../ast/utils';
import { extractParameters, registerReferencedTypes } from '../types/parameters';
import {
  buildSchema,
  buildSchemaFromTypeNode,
  typeNodeDefersExpansion,
  typeNodeOfSignature,
} from '../types/schema-builder';
import type { SerializerContext } from './context';
import { extractExportMetadata } from './shared';

/**
 * Build the return schema for a signature, detecting type guards.
 * Type guards have the form: (value: T) => value is U
 */
function buildReturnSchema(sig: ts.Signature, ctx: SerializerContext): SpecSignatureReturn {
  const returnType = ctx.typeChecker.getReturnTypeOfSignature(sig);

  // Register return type references
  registerReferencedTypes(returnType, ctx);

  const schema = buildSchema(returnType, ctx.typeChecker, ctx, typeNodeOfSignature(sig));

  // Check for type predicate (type guard)
  const declaration = sig.getDeclaration();
  if (declaration && ts.isFunctionLike(declaration) && declaration.type) {
    const returnTypeNode = declaration.type;

    if (ts.isTypePredicateNode(returnTypeNode)) {
      // Extract parameter name
      const parameterName = ts.isIdentifier(returnTypeNode.parameterName)
        ? returnTypeNode.parameterName.text
        : returnTypeNode.parameterName.getText();

      // Extract the predicate type
      let predicateTypeSchema: SpecSchema = { type: 'unknown' };
      if (returnTypeNode.type) {
        const predicateType = ctx.typeChecker.getTypeAtLocation(returnTypeNode.type);
        predicateTypeSchema = buildSchema(predicateType, ctx.typeChecker, ctx);
        registerReferencedTypes(predicateType, ctx);
      }

      // Add x-ts-type-predicate to the schema
      // Ensure schema is an object (not a string shorthand) before spreading
      const baseSchema = typeof schema === 'string' ? { type: schema } : schema;
      const schemaWithPredicate = {
        ...baseSchema,
        'x-ts-type-predicate': {
          parameterName,
          type: predicateTypeSchema,
        },
      };

      return { schema: schemaWithPredicate };
    }
  }

  return { schema };
}

function functionSignatureDecls(
  node: ts.FunctionDeclaration | ts.ArrowFunction | ts.FunctionExpression,
  ctx: SerializerContext,
): ts.SignatureDeclaration[] {
  if (!ts.isFunctionDeclaration(node) || !node.name) return [node];
  const symbol = ctx.typeChecker.getSymbolAtLocation(node.name);
  const fns = (symbol?.declarations ?? []).filter(ts.isFunctionDeclaration);
  const overloads = fns.filter((d) => !d.body);
  return overloads.length > 0 ? overloads : [node];
}

function signatureDeclDefers(decl: ts.SignatureDeclaration, ctx: SerializerContext): boolean {
  const checker = ctx.typeChecker;
  if (decl.typeParameters) {
    for (const tp of decl.typeParameters) {
      if (typeNodeDefersExpansion(tp.constraint, checker, ctx.program)) return true;
      if (typeNodeDefersExpansion(tp.default, checker, ctx.program)) return true;
    }
  }
  for (const p of decl.parameters) {
    if (typeNodeDefersExpansion(p.type, checker, ctx.program)) return true;
  }
  return typeNodeDefersExpansion(decl.type, checker, ctx.program);
}

function anySignatureDefers(
  node: ts.FunctionDeclaration | ts.ArrowFunction | ts.FunctionExpression,
  ctx: SerializerContext,
): boolean {
  return functionSignatureDecls(node, ctx).some((d) => signatureDeclDefers(d, ctx));
}

function schemaFromTypeNode(node: ts.TypeNode | undefined, ctx: SerializerContext): SpecSchema {
  if (!node) return { type: 'unknown' };
  if (typeNodeDefersExpansion(node, ctx.typeChecker, ctx.program)) {
    return buildSchemaFromTypeNode(node, ctx.typeChecker, ctx);
  }
  return buildSchema(ctx.typeChecker.getTypeFromTypeNode(node), ctx.typeChecker, ctx, node);
}

function parametersFromAst(
  decl: ts.SignatureDeclaration,
  ctx: SerializerContext,
): SpecSignatureParameter[] {
  const jsdocTags = ts.getJSDocTags(decl);
  return decl.parameters.map((p) => {
    const name = ts.isIdentifier(p.name) ? p.name.text : p.name.getText();
    const isOptional = !!p.questionToken || !!p.initializer;
    const param: SpecSignatureParameter = {
      name,
      schema: schemaFromTypeNode(p.type, ctx),
      required: !isOptional && !p.dotDotDotToken,
      ...(p.dotDotDotToken ? { rest: true } : {}),
    };
    const description = getParamDescription(name, jsdocTags);
    if (description) param.description = description;
    return param;
  });
}

function signaturesFromAst(
  decls: ts.SignatureDeclaration[],
  ctx: SerializerContext,
): SpecSignature[] {
  return decls.map((decl, index) => {
    const sigDoc = getJSDocComment(decl);
    const sigTypeParams =
      ts.isFunctionDeclaration(decl) ||
      ts.isArrowFunction(decl) ||
      ts.isFunctionExpression(decl) ||
      ts.isFunctionTypeNode(decl)
        ? extractTypeParameters(decl, ctx.typeChecker)
        : undefined;
    const returns: SpecSignatureReturn = { schema: schemaFromTypeNode(decl.type, ctx) };
    return {
      parameters: parametersFromAst(decl, ctx),
      returns,
      ...(sigDoc.description ? { description: sigDoc.description } : {}),
      ...(sigDoc.tags.length > 0 ? { tags: sigDoc.tags } : {}),
      ...(sigDoc.examples.length > 0 ? { examples: sigDoc.examples } : {}),
      ...(sigTypeParams ? { typeParameters: sigTypeParams } : {}),
      ...(decls.length > 1 ? { overloadIndex: index } : {}),
    };
  });
}

function signaturesFromChecker(
  callSignatures: readonly ts.Signature[],
  ctx: SerializerContext,
): SpecSignature[] {
  return callSignatures.map((sig, index) => {
    const sigDoc = getJSDocForSignature(sig, ctx.typeChecker);
    const sigTypeParams = extractTypeParametersFromSignature(sig, ctx.typeChecker);
    return {
      parameters: extractParameters(sig, ctx),
      returns: buildReturnSchema(sig, ctx),
      ...(sigDoc.description ? { description: sigDoc.description } : {}),
      ...(sigDoc.tags.length > 0 ? { tags: sigDoc.tags } : {}),
      ...(sigDoc.examples.length > 0 ? { examples: sigDoc.examples } : {}),
      ...(sigTypeParams ? { typeParameters: sigTypeParams } : {}),
      ...(callSignatures.length > 1 ? { overloadIndex: index } : {}),
    };
  });
}

function unwrapParens(node: ts.TypeNode): ts.TypeNode {
  return ts.isParenthesizedTypeNode(node) ? unwrapParens(node.type) : node;
}

/**
 * Signatures of a written annotation (`const f: T = ...`). The annotation is the
 * public contract; the initializer is only checked against it, so its own
 * parameter list (`(...args) => impl(...args)`) says nothing to a caller.
 * Undefined when `T` is not callable or is too expensive to instantiate.
 */
function signaturesFromDeclaredType(
  typeNode: ts.TypeNode,
  ctx: SerializerContext,
): SpecSignature[] | undefined {
  const inner = unwrapParens(typeNode);
  if (ts.isFunctionTypeNode(inner) && signatureDeclDefers(inner, ctx)) {
    return signaturesFromAst([inner], ctx);
  }
  if (typeNodeDefersExpansion(inner, ctx.typeChecker, ctx.program)) return undefined;
  const callSignatures = ctx.typeChecker.getTypeFromTypeNode(inner).getCallSignatures();
  return callSignatures.length > 0 ? signaturesFromChecker(callSignatures, ctx) : undefined;
}

/**
 * @param declaredType - Written annotation of the variable holding `node`; when callable it supplies the signatures.
 */
export function serializeFunctionExport(
  node: ts.FunctionDeclaration | ts.ArrowFunction | ts.FunctionExpression,
  ctx: SerializerContext,
  nameOverride?: string,
  declaredType?: ts.TypeNode,
): SpecExport | null {
  // Get name from override (for arrow fns), symbol, or node name
  const symbol = ctx.typeChecker.getSymbolAtLocation(node.name ?? node);
  const name = nameOverride ?? symbol?.getName() ?? node.name?.getText();
  if (!name) return null;

  const { description, tags, examples, source, deprecated, deprecationReason, inlineTags } =
    extractExportMetadata(node, symbol, ctx.typeChecker);

  // Extract type parameters like <T, K extends Base>
  const declaredFn = declaredType && unwrapParens(declaredType);
  const typeParameters = extractTypeParameters(
    declaredFn && ts.isFunctionTypeNode(declaredFn) ? declaredFn : node,
    ctx.typeChecker,
  );

  // getTypeAtLocation instantiates param/constraint types. ValidPaths / DeepPickN
  // never come back from that call — serialize those signatures from the AST.
  const signatures: SpecSignature[] =
    (declaredType && signaturesFromDeclaredType(declaredType, ctx)) ??
    (anySignatureDefers(node, ctx)
      ? signaturesFromAst(functionSignatureDecls(node, ctx), ctx)
      : signaturesFromChecker(ctx.typeChecker.getTypeAtLocation(node).getCallSignatures(), ctx));

  // Detect async and generator flags
  const flags: Record<string, unknown> = {};
  const modifiers = ts.getModifiers(node);
  if (modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword)) {
    flags.async = true;
  }
  if (node.asteriskToken) {
    flags.generator = true;
  }

  return {
    id: name,
    name,
    kind: 'function',
    description,
    tags,
    source,
    typeParameters,
    signatures,
    ...(Object.keys(flags).length > 0 ? { flags } : {}),
    ...(deprecated ? { deprecated: true, deprecationReason } : {}),
    ...(examples.length > 0 ? { examples } : {}),
    ...(inlineTags ? { inlineTags } : {}),
  };
}
