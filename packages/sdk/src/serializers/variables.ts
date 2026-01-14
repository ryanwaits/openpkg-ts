import type { SpecExport } from '@openpkg-ts/spec';
import type ts from 'typescript';
import { getJSDocComment, getSourceLocation, isSymbolDeprecated } from '../ast/utils';
import { extractSchemaType } from '../schema/registry';
// Import adapters to ensure they're registered (side effect)
import '../schema/adapters';
import { registerReferencedTypes } from '../types/parameters';
import { buildSchema } from '../types/schema-builder';
import type { SerializerContext } from './context';

export function serializeVariable(
  node: ts.VariableDeclaration,
  statement: ts.VariableStatement,
  ctx: SerializerContext,
): SpecExport | null {
  const symbol = ctx.typeChecker.getSymbolAtLocation(node.name);
  const name = symbol?.getName() ?? node.name.getText();
  if (!name) return null;

  const deprecated = isSymbolDeprecated(symbol);
  const declSourceFile = node.getSourceFile();
  const { description, tags, examples } = getJSDocComment(statement, symbol, ctx.typeChecker);
  const source = getSourceLocation(node, declSourceFile);
  const type = ctx.typeChecker.getTypeAtLocation(node);

  // Check if this is a schema library type (Zod, Valibot, TypeBox, ArkType)
  // If so, extract the output type instead of serializing the full schema class
  const schemaExtraction = extractSchemaType(type, ctx.typeChecker);
  const typeToSerialize = schemaExtraction?.outputType ?? type;

  // Register referenced types FIRST (before buildSchema adds to visitedTypes)
  registerReferencedTypes(typeToSerialize, ctx);

  // Then build the schema
  const schema = buildSchema(typeToSerialize, ctx.typeChecker, ctx);

  // Add schema library metadata if this was a schema type
  const flags = schemaExtraction
    ? {
        schemaLibrary: schemaExtraction.adapter.id,
        ...(schemaExtraction.inputType && schemaExtraction.inputType !== schemaExtraction.outputType
          ? { hasTransform: true }
          : {}),
      }
    : undefined;

  return {
    id: name,
    name,
    kind: 'variable',
    description,
    tags,
    source,
    schema,
    ...(flags ? { flags } : {}),
    ...(deprecated ? { deprecated: true } : {}),
    ...(examples.length > 0 ? { examples } : {}),
  };
}
