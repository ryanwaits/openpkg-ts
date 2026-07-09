import type { SpecExample, SpecSignature, SpecSource, SpecTag } from '@openpkg-ts/spec';
import type ts from 'typescript';
import {
  extractTypeParametersFromSignature,
  getJSDocComment,
  getJSDocForSignature,
  getSourceLocation,
  isSymbolDeprecated,
} from '../ast/utils';
import { extractParameters, registerReferencedTypes } from '../types/parameters';
import { buildSchema } from '../types/schema-builder';
import type { SerializerContext } from './context';

export interface ExportMetadata {
  description?: string;
  tags: SpecTag[];
  examples: SpecExample[];
  source: SpecSource;
  deprecated: boolean;
  deprecationReason?: string;
}

/**
 * Extract common metadata shared by all export serializers.
 * @param jsdocNode - Node to extract JSDoc from (defaults to `node`). Variables pass the statement node.
 */
export function extractExportMetadata(
  node: ts.Node,
  symbol: ts.Symbol | undefined,
  checker: ts.TypeChecker,
  jsdocNode?: ts.Node,
): ExportMetadata {
  const { deprecated, reason: deprecationReason } = isSymbolDeprecated(symbol);
  const { description, tags, examples } = getJSDocComment(jsdocNode ?? node, symbol, checker);
  const source = getSourceLocation(node, node.getSourceFile());
  return { description, tags, examples, source, deprecated, deprecationReason };
}

/**
 * Build SpecSignature[] from TypeScript call signatures.
 * Shared by class method and interface method serializers.
 */
export function buildSignatures(
  callSignatures: readonly ts.Signature[],
  checker: ts.TypeChecker,
  ctx: SerializerContext,
): SpecSignature[] {
  return callSignatures.map((sig, index) => {
    const params = extractParameters(sig, ctx);
    const returnType = checker.getReturnTypeOfSignature(sig);
    registerReferencedTypes(returnType, ctx);

    const sigDoc = getJSDocForSignature(sig, checker);
    const sigTypeParams = extractTypeParametersFromSignature(sig, checker);

    return {
      parameters: params.length > 0 ? params : undefined,
      returns: { schema: buildSchema(returnType, checker, ctx) },
      ...(sigDoc.description ? { description: sigDoc.description } : {}),
      ...(sigDoc.tags.length > 0 ? { tags: sigDoc.tags } : {}),
      ...(sigDoc.examples.length > 0 ? { examples: sigDoc.examples } : {}),
      ...(sigTypeParams ? { typeParameters: sigTypeParams } : {}),
      ...(callSignatures.length > 1 ? { overloadIndex: index } : {}),
    };
  });
}
