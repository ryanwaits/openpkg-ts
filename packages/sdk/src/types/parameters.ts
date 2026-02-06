import type { SpecSignatureParameter } from '@openpkg-ts/spec';
import ts from 'typescript';
import { getParamDescription } from '../ast/utils';
import type { SerializerContext } from '../serializers/context';
import { buildSchema } from './schema-builder';

/**
 * Strip `undefined` from a union type when the parameter is already optional.
 * This avoids redundant `{ anyOf: [{ type: 'number' }, { type: 'undefined' }] }`
 * when `required: false` already expresses optionality.
 */
function stripUndefinedFromType(type: ts.Type, checker: ts.TypeChecker): ts.Type {
  if (!type.isUnion()) return type;

  // Filter out undefined from the union
  const nonUndefinedTypes = type.types.filter((t) => !(t.flags & ts.TypeFlags.Undefined));

  // If no types remain or all were undefined, return original
  if (nonUndefinedTypes.length === 0) return type;

  // If only one type remains, return it directly
  if (nonUndefinedTypes.length === 1) return nonUndefinedTypes[0];

  // Otherwise, create a new union type without undefined
  return checker.getUnionType(nonUndefinedTypes);
}

export function extractParameters(
  signature: ts.Signature,
  ctx: SerializerContext,
): SpecSignatureParameter[] {
  const { typeChecker: checker } = ctx;
  const result: SpecSignatureParameter[] = [];

  // Get JSDoc tags from the signature declaration for param descriptions
  const signatureDecl = signature.getDeclaration();
  const jsdocTags = signatureDecl ? ts.getJSDocTags(signatureDecl) : [];

  for (const param of signature.getParameters()) {
    const decl = param.valueDeclaration as ts.ParameterDeclaration | undefined;
    if (!decl) continue;
    const type = checker.getTypeOfSymbolAtLocation(param, decl);

    // Check if this is a destructured parameter (ObjectBindingPattern)
    if (decl && ts.isObjectBindingPattern(decl.name)) {
      const expandedParams = expandBindingPattern(decl, type, jsdocTags, ctx);
      result.push(...expandedParams);
    } else {
      // Regular parameter - check questionToken or initializer for optionality
      const isOptional = !!decl?.questionToken || !!decl?.initializer;

      // Strip undefined from optional params - optionality is expressed via required: false
      const effectiveType = isOptional ? stripUndefinedFromType(type, checker) : type;
      registerReferencedTypes(effectiveType, ctx);

      // Get description from @param tag
      const paramName = param.getName();
      const description = getParamDescription(paramName, jsdocTags);

      const paramResult: SpecSignatureParameter = {
        name: paramName,
        schema: buildSchema(effectiveType, checker, ctx),
        required: !isOptional,
      };

      if (description) {
        paramResult.description = description;
      }

      result.push(paramResult);
    }
  }

  return result;
}

/**
 * Expand ObjectBindingPattern parameters into individual properties.
 * Handles destructured params like ({ a, b }: { a: string; b: number })
 */
function expandBindingPattern(
  paramDecl: ts.ParameterDeclaration,
  paramType: ts.Type,
  jsdocTags: readonly ts.JSDocTag[],
  ctx: SerializerContext,
): SpecSignatureParameter[] {
  const { typeChecker: checker } = ctx;
  const result: SpecSignatureParameter[] = [];
  const bindingPattern = paramDecl.name as ts.ObjectBindingPattern;

  // Get all properties from the full type (including intersection types)
  const allProperties = getEffectiveProperties(paramType, checker);

  // Infer param alias from JSDoc tags (e.g., @param opts.name → alias is "opts")
  const inferredAlias = inferParamAlias(jsdocTags);

  for (const element of bindingPattern.elements) {
    if (!ts.isBindingElement(element)) continue;

    // Get property name (handle re-aliasing like { foo: bar })
    const propertyName = element.propertyName
      ? ts.isIdentifier(element.propertyName)
        ? element.propertyName.text
        : element.propertyName.getText()
      : ts.isIdentifier(element.name)
        ? element.name.text
        : element.name.getText();

    // Find the property in the type
    const propSymbol = allProperties.get(propertyName);
    if (!propSymbol) continue;

    // Check optionality: property is optional OR has default value
    const isOptional =
      !!(propSymbol.flags & ts.SymbolFlags.Optional) || element.initializer !== undefined;

    const propType = checker.getTypeOfSymbol(propSymbol);
    // Strip undefined from optional props - optionality is expressed via required: false
    const effectiveType = isOptional ? stripUndefinedFromType(propType, checker) : propType;
    registerReferencedTypes(effectiveType, ctx);

    // Get description from JSDoc
    const description = getParamDescription(propertyName, jsdocTags, inferredAlias);

    const param: SpecSignatureParameter = {
      name: propertyName,
      schema: buildSchema(effectiveType, checker, ctx),
      required: !isOptional,
    };

    if (description) {
      param.description = description;
    }

    // Extract default value if present
    if (element.initializer) {
      param.default = extractDefaultValue(element.initializer);
    }

    result.push(param);
  }

  return result;
}

/**
 * Get all properties from a type, flattening intersection types.
 */
function getEffectiveProperties(type: ts.Type, _checker: ts.TypeChecker): Map<string, ts.Symbol> {
  const properties = new Map<string, ts.Symbol>();

  if (type.isIntersection()) {
    // Flatten intersection types
    for (const subType of type.types) {
      for (const prop of subType.getProperties()) {
        properties.set(prop.getName(), prop);
      }
    }
  } else {
    // Regular type
    for (const prop of type.getProperties()) {
      properties.set(prop.getName(), prop);
    }
  }

  return properties;
}

/**
 * Infer parameter alias from JSDoc @param tags.
 * Looks for patterns like @param opts.name where "opts" is the alias.
 */
function inferParamAlias(jsdocTags: readonly ts.JSDocTag[]): string | undefined {
  const prefixes: string[] = [];

  for (const tag of jsdocTags) {
    if (tag.tagName.text !== 'param') continue;

    // Extract the parameter name from the tag
    const tagText =
      typeof tag.comment === 'string' ? tag.comment : (ts.getTextOfJSDocComment(tag.comment) ?? '');

    // Handle @param {type} name.prop or @param name.prop patterns
    const paramTag = tag as ts.JSDocParameterTag;
    const paramName = paramTag.name?.getText() ?? '';

    if (paramName.includes('.')) {
      const prefix = paramName.split('.')[0];
      if (prefix && !prefix.startsWith('__')) {
        prefixes.push(prefix);
      }
    } else if (tagText.includes('.')) {
      // Fallback: check comment text for dotted names
      const match = tagText.match(/^(\w+)\./);
      if (match && !match[1].startsWith('__')) {
        prefixes.push(match[1]);
      }
    }
  }

  if (prefixes.length === 0) return undefined;

  // Return the most common prefix
  const counts = new Map<string, number>();
  for (const p of prefixes) counts.set(p, (counts.get(p) ?? 0) + 1);
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];
}

/**
 * Extract default value from initializer expression.
 */
function extractDefaultValue(initializer: ts.Expression): unknown {
  if (ts.isStringLiteral(initializer)) {
    return initializer.text;
  }
  if (ts.isNumericLiteral(initializer)) {
    return Number(initializer.text);
  }
  if (initializer.kind === ts.SyntaxKind.TrueKeyword) {
    return true;
  }
  if (initializer.kind === ts.SyntaxKind.FalseKeyword) {
    return false;
  }
  if (initializer.kind === ts.SyntaxKind.NullKeyword) {
    return null;
  }
  // For complex expressions, return the text representation
  return initializer.getText();
}

/**
 * Recursively register types referenced by a ts.Type.
 * Uses ctx.registeredTypes to prevent re-processing already-registered types.
 */
export function registerReferencedTypes(type: ts.Type, ctx: SerializerContext, depth = 0): void {
  // Limit traversal depth to prevent explosion
  if (depth > ctx.maxTypeDepth) return;

  // Prevent re-registration of already-processed types
  if (ctx.registeredTypes.has(type)) return;

  // Only add complex types to registeredTypes (not primitives/literals which can't be circular)
  const isPrimitive =
    type.flags &
    (ts.TypeFlags.String |
      ts.TypeFlags.Number |
      ts.TypeFlags.Boolean |
      ts.TypeFlags.Void |
      ts.TypeFlags.Undefined |
      ts.TypeFlags.Null |
      ts.TypeFlags.Any |
      ts.TypeFlags.Unknown |
      ts.TypeFlags.Never |
      ts.TypeFlags.StringLiteral |
      ts.TypeFlags.NumberLiteral |
      ts.TypeFlags.BooleanLiteral);

  if (!isPrimitive) {
    ctx.registeredTypes.add(type);
  }

  const { typeChecker: checker, typeRegistry } = ctx;

  // Register the type itself
  typeRegistry.registerType(type, ctx);

  // Handle type arguments (generics like Array<T>, Promise<T>)
  const typeArgs = (type as ts.TypeReference).typeArguments;
  if (typeArgs) {
    for (const arg of typeArgs) {
      registerReferencedTypes(arg, ctx, depth + 1);
    }
  }

  // Handle union types
  if (type.isUnion()) {
    for (const t of type.types) {
      registerReferencedTypes(t, ctx, depth + 1);
    }
  }

  // Handle intersection types
  if (type.isIntersection()) {
    for (const t of type.types) {
      registerReferencedTypes(t, ctx, depth + 1);
    }
  }

  // Handle object properties (traverse into object members)
  if (type.flags & ts.TypeFlags.Object) {
    const props = type.getProperties();
    const limit = ctx.maxProperties;
    if (props.length > limit && ctx.onTruncation) {
      const typeName = type.getSymbol()?.getName() ?? 'anonymous';
      ctx.onTruncation(typeName, props.length, limit);
    }
    for (const prop of props.slice(0, limit)) {
      const propType = checker.getTypeOfSymbol(prop);
      registerReferencedTypes(propType, ctx, depth + 1);
    }
  }
}
