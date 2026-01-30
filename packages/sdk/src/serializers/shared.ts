import type { SpecSource } from '@openpkg-ts/spec';
import type ts from 'typescript';
import { getJSDocComment, getSourceLocation, isSymbolDeprecated } from '../ast/utils';

export interface ExportMetadata {
  description?: string;
  tags?: string[];
  examples?: string[];
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
