import type { SpecExport, SpecSchema } from '@openpkg-ts/spec';
import ts from 'typescript';
import { extractTypeParameters } from '../ast/utils';
import { registerReferencedTypes } from '../types/parameters';
import { buildSchema } from '../types/schema-builder';
import type { SerializerContext } from './context';
import { extractExportMetadata } from './shared';

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
  if (ts.isIntersectionTypeNode(node.type)) {
    schema = buildIntersectionSchemaFromNode(node.type, ctx);
  } else {
    // Then build the schema normally
    schema = buildSchema(type, ctx.typeChecker, ctx);
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
    ...(deprecated ? { deprecated: true, deprecationReason } : {}),
    ...(examples.length > 0 ? { examples } : {}),
  };
}
