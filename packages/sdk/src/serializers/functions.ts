import type { SpecExport, SpecSchema, SpecSignature, SpecSignatureReturn } from '@openpkg-ts/spec';
import ts from 'typescript';
import {
  extractTypeParameters,
  extractTypeParametersFromSignature,
  getJSDocForSignature,
} from '../ast/utils';
import { extractParameters, registerReferencedTypes } from '../types/parameters';
import { buildSchema } from '../types/schema-builder';
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

  const schema = buildSchema(returnType, ctx.typeChecker, ctx);

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

export function serializeFunctionExport(
  node: ts.FunctionDeclaration | ts.ArrowFunction,
  ctx: SerializerContext,
  nameOverride?: string,
): SpecExport | null {
  // Get name from override (for arrow fns), symbol, or node name
  const symbol = ctx.typeChecker.getSymbolAtLocation(node.name ?? node);
  const name = nameOverride ?? symbol?.getName() ?? node.name?.getText();
  if (!name) return null;

  const { description, tags, examples, source, deprecated, deprecationReason } =
    extractExportMetadata(node, symbol, ctx.typeChecker);

  // Extract type parameters like <T, K extends Base>
  const typeParameters = extractTypeParameters(node, ctx.typeChecker);

  const type = ctx.typeChecker.getTypeAtLocation(node);
  const callSignatures = type.getCallSignatures();

  const signatures: SpecSignature[] = callSignatures.map((sig, index) => {
    const params = extractParameters(sig, ctx);

    // Get per-overload JSDoc
    const sigDoc = getJSDocForSignature(sig, ctx.typeChecker);

    // Get per-overload type parameters
    const sigTypeParams = extractTypeParametersFromSignature(sig, ctx.typeChecker);

    return {
      parameters: params,
      returns: buildReturnSchema(sig, ctx),
      ...(sigDoc.description ? { description: sigDoc.description } : {}),
      ...(sigDoc.tags.length > 0 ? { tags: sigDoc.tags } : {}),
      ...(sigDoc.examples.length > 0 ? { examples: sigDoc.examples } : {}),
      ...(sigTypeParams ? { typeParameters: sigTypeParams } : {}),
      ...(callSignatures.length > 1 ? { overloadIndex: index } : {}),
    };
  });

  return {
    id: name,
    name,
    kind: 'function',
    description,
    tags,
    source,
    typeParameters,
    signatures,
    ...(deprecated ? { deprecated: true, deprecationReason } : {}),
    ...(examples.length > 0 ? { examples } : {}),
  };
}
