import type { SpecExport } from '@openpkg-ts/spec';
import ts from 'typescript';
import { extractSchemaType } from '../schema/registry';
import { extractExportMetadata } from './shared';
// Import adapters to ensure they're registered (side effect)
import '../schema/adapters';
import { registerReferencedTypes } from '../types/parameters';
import { buildSchema } from '../types/schema-builder';
import type { SerializerContext } from './context';

/**
 * @param node - The declaration, or the binding element for names bound by
 *   destructuring (`const [a, { b }] = init`); the checker types each binding.
 */
export function serializeVariable(
  node: ts.VariableDeclaration | ts.BindingElement,
  statement: ts.VariableStatement,
  ctx: SerializerContext,
): SpecExport | null {
  const symbol = ctx.typeChecker.getSymbolAtLocation(node.name);
  const name = symbol?.getName() ?? node.name.getText();
  if (!name) return null;

  const { description, tags, examples, source, deprecated, deprecationReason, inlineTags } =
    extractExportMetadata(node, symbol, ctx.typeChecker, statement);
  const type = ctx.typeChecker.getTypeAtLocation(node);

  // Check if this is a schema library type (Zod, Valibot, TypeBox, ArkType)
  // If so, extract the output type instead of serializing the full schema class
  const schemaExtraction = extractSchemaType(type, ctx.typeChecker);
  const typeToSerialize = schemaExtraction?.outputType ?? type;

  // Register referenced types FIRST (before buildSchema adds to visitedTypes)
  registerReferencedTypes(typeToSerialize, ctx);

  // Then build the schema
  const schema = buildSchema(
    typeToSerialize,
    ctx.typeChecker,
    ctx,
    ts.isVariableDeclaration(node) ? node.type : undefined,
  );

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
    ...(deprecated ? { deprecated: true, deprecationReason } : {}),
    ...(examples.length > 0 ? { examples } : {}),
    ...(inlineTags ? { inlineTags } : {}),
  };
}
