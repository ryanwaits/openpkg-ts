import type { SpecInheritedMember, SpecSignature, SpecVisibility } from '@openpkg-ts/spec';
import ts from 'typescript';
import { TypeRegistry } from '../ast/registry';
import { getJSDocComment, getJSDocForSignature } from '../ast/utils';
import { extractParameters, registerReferencedTypes } from '../types/parameters';
import { buildSchema } from '../types/schema-builder';

export interface SerializerContext {
  typeChecker: ts.TypeChecker;
  program: ts.Program;
  sourceFile: ts.SourceFile;
  maxTypeDepth: number;
  maxExternalTypeDepth: number;
  currentDepth: number;
  resolveExternalTypes: boolean;
  typeRegistry: TypeRegistry;
  exportedIds: Set<string>;
  /** Stack-style recursion guard for buildSchemaInternal (add before recurse, delete after) */
  visitedTypes: Set<ts.Type>;
  /** Permanent "already processed" set for registerReferencedTypes */
  registeredTypes: Set<ts.Type>;
  /** Flag to indicate we're processing tuple elements - skip Array prototype methods */
  inTupleElement?: boolean;
  /** Include private/protected class members (default: false) */
  includePrivate?: boolean;
  /** Max properties to serialize per object type (default: 20) */
  maxProperties: number;
  /** Callback when properties are truncated */
  onTruncation?: (typeName: string, actual: number, limit: number) => void;
}

export interface CreateContextOptions {
  maxTypeDepth?: number;
  maxExternalTypeDepth?: number;
  resolveExternalTypes?: boolean;
  includePrivate?: boolean;
  maxProperties?: number;
  onTruncation?: (typeName: string, actual: number, limit: number) => void;
}

export function createContext(
  program: ts.Program,
  sourceFile: ts.SourceFile,
  options: CreateContextOptions = {},
): SerializerContext {
  return {
    typeChecker: program.getTypeChecker(),
    program,
    sourceFile,
    maxTypeDepth: options.maxTypeDepth ?? 5,
    maxExternalTypeDepth: options.maxExternalTypeDepth ?? 2,
    currentDepth: 0,
    resolveExternalTypes: options.resolveExternalTypes ?? true,
    typeRegistry: new TypeRegistry(),
    exportedIds: new Set<string>(),
    visitedTypes: new Set<ts.Type>(),
    registeredTypes: new Set<ts.Type>(),
    includePrivate: options.includePrivate ?? false,
    maxProperties: options.maxProperties ?? 20,
    onTruncation: options.onTruncation,
  };
}

/**
 * Get inherited members from base classes.
 * Walks the inheritance chain and collects members that are not overridden in the child class.
 */
export function getInheritedMembers(
  classType: ts.Type,
  ownMemberNames: Set<string>,
  ctx: SerializerContext,
  isStatic: boolean = false,
): SpecInheritedMember[] {
  const { typeChecker: checker } = ctx;
  const inherited: SpecInheritedMember[] = [];
  const visited = new Set<ts.Type>();
  const inheritedNames = new Set<string>();

  // For static members, we need to get the constructor type
  let typeToWalk: ts.Type | undefined = classType;
  if (isStatic) {
    const symbol = classType.getSymbol();
    const valueDecl = symbol?.valueDeclaration;
    typeToWalk =
      symbol && valueDecl ? checker.getTypeOfSymbolAtLocation(symbol, valueDecl) : undefined;
  }

  if (!typeToWalk) return inherited;

  walkBaseTypes(
    typeToWalk as ts.Type,
    ownMemberNames,
    inherited,
    inheritedNames,
    visited,
    ctx,
    isStatic,
  );
  return inherited;
}

function walkBaseTypes(
  type: ts.Type,
  ownMemberNames: Set<string>,
  inherited: SpecInheritedMember[],
  inheritedNames: Set<string>,
  visited: Set<ts.Type>,
  ctx: SerializerContext,
  isStatic: boolean,
): void {
  // Prevent infinite recursion
  if (visited.has(type)) return;
  visited.add(type);

  const { typeChecker: checker } = ctx;
  const baseTypes = type.getBaseTypes?.() ?? [];

  for (const baseType of baseTypes) {
    const baseSymbol = baseType.getSymbol();
    const baseName = baseSymbol?.getName() ?? 'unknown';

    // Get properties from this base class
    const properties = isStatic ? getStaticMembers(baseType, checker) : baseType.getProperties();

    for (const prop of properties) {
      const propName = prop.getName();

      // Skip if already defined in child or already inherited
      if (ownMemberNames.has(propName)) continue;
      if (inheritedNames.has(propName)) continue;

      // Skip private members (start with #) and internal properties
      if (propName.startsWith('#') || propName.startsWith('__')) continue;

      const member = serializeInheritedMember(prop, baseName, ctx, isStatic);
      if (member) {
        inherited.push(member);
        inheritedNames.add(propName);
      }
    }

    // Recursively walk up the chain
    walkBaseTypes(baseType, ownMemberNames, inherited, inheritedNames, visited, ctx, isStatic);
  }
}

function getStaticMembers(classType: ts.Type, checker: ts.TypeChecker): ts.Symbol[] {
  const symbol = classType.getSymbol();
  if (!symbol) return [];

  // Get the constructor type which holds static members
  const decl = symbol.valueDeclaration;
  if (!decl) return [];

  const constructorType = checker.getTypeOfSymbolAtLocation(symbol, decl);
  return constructorType.getProperties().filter((prop) => {
    // Filter out prototype and other non-static members
    const name = prop.getName();
    return name !== 'prototype' && name !== 'constructor' && !name.startsWith('__');
  });
}

function serializeInheritedMember(
  symbol: ts.Symbol,
  inheritedFrom: string,
  ctx: SerializerContext,
  isStatic: boolean,
): SpecInheritedMember | null {
  const { typeChecker: checker } = ctx;
  const name = symbol.getName();

  // Get the declaration to extract JSDoc and determine kind
  const declarations = symbol.getDeclarations() ?? [];
  const decl = declarations[0];
  if (!decl) return null;

  // Get type
  const type = checker.getTypeOfSymbol(symbol);
  registerReferencedTypes(type, ctx);

  // Determine visibility
  let visibility: SpecVisibility | undefined;
  if (decl && ts.canHaveModifiers(decl)) {
    const modifiers = ts.getModifiers(decl);
    if (modifiers) {
      for (const mod of modifiers) {
        if (mod.kind === ts.SyntaxKind.PrivateKeyword) visibility = 'private';
        else if (mod.kind === ts.SyntaxKind.ProtectedKeyword) visibility = 'protected';
        else if (mod.kind === ts.SyntaxKind.PublicKeyword) visibility = 'public';
      }
    }
  }

  // Skip private members
  if (visibility === 'private') return null;

  const { description, tags } = getJSDocComment(decl);

  // Determine kind
  let kind: string = 'property';
  const callSigs = type.getCallSignatures();
  if (callSigs.length > 0) {
    kind = 'method';
  } else if (ts.isGetAccessorDeclaration(decl)) {
    kind = 'getter';
  } else if (ts.isSetAccessorDeclaration(decl)) {
    kind = 'setter';
  }

  const flags: Record<string, unknown> = {};
  if (isStatic) flags.static = true;
  if (decl && ts.canHaveModifiers(decl)) {
    const modifiers = ts.getModifiers(decl);
    if (modifiers?.some((m) => m.kind === ts.SyntaxKind.ReadonlyKeyword)) {
      flags.readonly = true;
    }
  }

  // Build signatures for methods
  let signatures: SpecSignature[] | undefined;
  if (kind === 'method' && callSigs.length > 0) {
    signatures = callSigs.map((sig, index) => {
      const params = extractParameters(sig, ctx);
      const returnType = checker.getReturnTypeOfSignature(sig);
      registerReferencedTypes(returnType, ctx);

      // Get per-overload JSDoc
      const sigDoc = getJSDocForSignature(sig, checker);

      return {
        parameters: params.length > 0 ? params : undefined,
        returns: {
          schema: buildSchema(returnType, checker, ctx),
        },
        ...(sigDoc.description ? { description: sigDoc.description } : {}),
        ...(sigDoc.tags.length > 0 ? { tags: sigDoc.tags } : {}),
        ...(callSigs.length > 1 ? { overloadIndex: index } : {}),
      };
    });
  }

  return {
    name,
    kind,
    inheritedFrom,
    description,
    tags: tags.length > 0 ? tags : undefined,
    visibility,
    schema: kind !== 'method' ? buildSchema(type, checker, ctx) : undefined,
    signatures,
    flags: Object.keys(flags).length > 0 ? flags : undefined,
  };
}
