import type {
  SpecExample,
  SpecExampleLanguage,
  SpecSource,
  SpecTag,
  SpecTagParam,
  SpecTypeParameter,
} from '@openpkg-ts/spec';
import ts from 'typescript';

/**
 * Parse @example tags into SpecExample objects.
 * Handles markdown code fences and extracts language.
 */
function parseExamplesFromTags(tags: SpecTag[]): SpecExample[] {
  const examples: SpecExample[] = [];

  for (const tag of tags) {
    if (tag.name !== 'example') continue;

    const text = tag.text.trim();
    // Match code fence: ```lang\ncode\n``` or ```\ncode\n```
    const fenceMatch = text.match(/^```(\w*)\n([\s\S]*?)\n?```$/);

    if (fenceMatch) {
      const lang = fenceMatch[1] || undefined;
      const code = fenceMatch[2].trim();
      const example: SpecExample = { code };
      if (lang && ['ts', 'js', 'tsx', 'jsx', 'shell', 'json'].includes(lang)) {
        example.language = lang as SpecExampleLanguage;
      }
      examples.push(example);
    } else if (text) {
      // No code fence, use raw text
      examples.push({ code: text });
    }
  }

  return examples;
}

/**
 * Strip TSDoc hyphen separator from description text.
 * TSDoc format: `@param name - description` -> TS extracts `- description`
 * We want just `description`.
 */
function stripParamSeparator(text: string | undefined): string | undefined {
  if (!text) return undefined;
  const stripped = text.replace(/^-\s*/, '').trim();
  return stripped || undefined;
}

/**
 * Strip TSDoc hyphen separator from @typeParam text.
 * TSDoc format: `@typeParam T - description` -> TS extracts `T - description`
 * We want just `description`.
 */
function stripTypeParamSeparator(text: string | undefined): string | undefined {
  if (!text) return undefined;
  // Match: TypeParamName - description (captures just description)
  const match = text.match(/^\w+\s+-\s*(.*)$/s);
  if (match) {
    return match[1].trim() || undefined;
  }
  return text.trim() || undefined;
}

/**
 * Extract text from @see tag, preserving full URLs.
 * TypeScript's getTextOfJSDocComment can sometimes strip URL protocols
 * because it treats protocol prefixes like 'https' as JSDocLink targets.
 * This function extracts the full text from the tag to preserve URLs.
 */
function extractSeeTagText(tag: ts.JSDocTag): string {
  // Get the full tag text and extract everything after @see
  // This is the most reliable way to preserve URLs
  const fullText = tag.getText();

  // Match @see followed by content (including URLs)
  // The regex captures everything after @see, handling multi-line content
  const seeMatch = fullText.match(/@see\s+(.+?)(?:\s*\*\s*@|\s*\*\/|$)/s);
  if (seeMatch) {
    // Clean up the matched content - remove trailing comment markers
    let text = seeMatch[1].trim();
    // Remove trailing " * " patterns from multi-line JSDoc
    text = text.replace(/\s*\*\s*$/gm, '').trim();
    if (text) return text;
  }

  // Fallback: try to construct from comment parts
  if (tag.comment) {
    if (typeof tag.comment === 'string') {
      // Check if it looks like a partial URL (starts with ://)
      // If so, we need to get the full text instead
      if (!tag.comment.startsWith('://')) {
        return tag.comment;
      }
    }

    // Handle NodeArray of JSDocComment parts
    if (Array.isArray(tag.comment)) {
      const parts: string[] = [];
      for (const part of tag.comment) {
        if (ts.isJSDocLink(part) || ts.isJSDocLinkCode(part) || ts.isJSDocLinkPlain(part)) {
          // JSDocLink has a name property (the identifier) and text property
          // For URLs, the name might be undefined and the full URL is in the text
          if (part.name) {
            parts.push(part.name.getText());
          }
          // The text property contains any text after the link/before the closing brace
          if (part.text) {
            parts.push(part.text);
          }
        } else if (part.kind === ts.SyntaxKind.JSDocText) {
          parts.push((part as ts.JSDocText).text);
        }
      }
      const result = parts.join('').trim();
      if (result && !result.startsWith('://')) return result;
    }
  }

  // Ultimate fallback to standard extraction
  return typeof tag.comment === 'string'
    ? tag.comment
    : (ts.getTextOfJSDocComment(tag.comment) ?? '');
}

export function getJSDocComment(node: ts.Node): {
  description?: string;
  tags: SpecTag[];
  examples: SpecExample[];
} {
  const jsDocTags = ts.getJSDocTags(node);
  const tags: SpecTag[] = jsDocTags.map((tag) => {
    const rawText =
      typeof tag.comment === 'string' ? tag.comment : (ts.getTextOfJSDocComment(tag.comment) ?? '');

    // For @param tags, populate structured param field
    if (tag.tagName.text === 'param') {
      const paramTag = tag as ts.JSDocParameterTag;
      const paramName = paramTag.name?.getText() ?? '';
      const description = stripParamSeparator(rawText);
      const text = description ? `${paramName} - ${description}` : paramName;

      // Extract type from {type} annotation if present
      const typeExpr = paramTag.typeExpression;
      const type = typeExpr ? typeExpr.type.getText() : undefined;

      // Build structured param data
      const param: SpecTagParam = { name: paramName };
      if (type) param.type = type;
      if (description) param.description = description;
      if (paramTag.isBracketed) param.optional = true;

      return { name: tag.tagName.text, text, param };
    }

    // For @typeParam, just strip the separator (name already in text)
    if (tag.tagName.text === 'typeParam') {
      const text = stripTypeParamSeparator(rawText) ?? '';
      return { name: tag.tagName.text, text };
    }

    // For @see tags, use special extraction to preserve URLs
    if (tag.tagName.text === 'see') {
      const text = extractSeeTagText(tag);
      return { name: tag.tagName.text, text };
    }

    return { name: tag.tagName.text, text: rawText };
  });

  // Get description from first JSDoc comment
  const jsDocComments = ts.getJSDocCommentsAndTags(node).filter(ts.isJSDoc);
  let description: string | undefined;
  if (jsDocComments.length > 0) {
    const firstDoc = jsDocComments[0];
    if (firstDoc.comment) {
      description =
        typeof firstDoc.comment === 'string'
          ? firstDoc.comment
          : ts.getTextOfJSDocComment(firstDoc.comment);
    }
  }

  // Parse @example tags into examples array
  const examples = parseExamplesFromTags(tags);

  return { description, tags, examples };
}

export function getSourceLocation(node: ts.Node, sourceFile: ts.SourceFile): SpecSource {
  const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  return {
    file: sourceFile.fileName,
    line: line + 1,
  };
}

/**
 * Get description for a destructured parameter property from JSDoc @param tags.
 * Matches patterns like:
 * - @param paramName - exact match
 * - @param opts.paramName - dotted notation with alias
 * - @param {type} paramName - type annotation format
 */
export function getParamDescription(
  propertyName: string,
  jsdocTags: readonly ts.JSDocTag[],
  inferredAlias?: string,
): string | undefined {
  for (const tag of jsdocTags) {
    if (tag.tagName.text !== 'param') continue;

    const paramTag = tag as ts.JSDocParameterTag;
    const tagParamName = paramTag.name?.getText() ?? '';

    // Try matching strategies:
    // 1. Exact match: @param propertyName
    // 2. With alias: @param alias.propertyName
    // 3. Any dotted ending: @param *.propertyName (fallback for __0 cases)
    const isMatch =
      tagParamName === propertyName ||
      (inferredAlias && tagParamName === `${inferredAlias}.${propertyName}`) ||
      tagParamName.endsWith(`.${propertyName}`);

    if (isMatch) {
      const comment =
        typeof tag.comment === 'string' ? tag.comment : ts.getTextOfJSDocComment(tag.comment);
      return stripParamSeparator(comment);
    }
  }

  return undefined;
}

type DeclarationWithTypeParams =
  | ts.FunctionDeclaration
  | ts.ClassDeclaration
  | ts.InterfaceDeclaration
  | ts.TypeAliasDeclaration
  | ts.MethodDeclaration
  | ts.ArrowFunction;

/**
 * Extract type parameters from declarations like `<T extends Base, K = Default>`
 * Also captures variance annotations (in/out) and const modifier.
 */
export function extractTypeParameters(
  node: DeclarationWithTypeParams,
  checker: ts.TypeChecker,
): SpecTypeParameter[] | undefined {
  if (!node.typeParameters || node.typeParameters.length === 0) {
    return undefined;
  }

  return node.typeParameters.map((tp) => {
    const name = tp.name.text;

    // Get constraint (T extends SomeType)
    let constraint: string | undefined;
    if (tp.constraint) {
      const constraintType = checker.getTypeAtLocation(tp.constraint);
      constraint = checker.typeToString(constraintType);
    }

    // Get default (T = DefaultType)
    let defaultType: string | undefined;
    if (tp.default) {
      const defType = checker.getTypeAtLocation(tp.default);
      defaultType = checker.typeToString(defType);
    }

    // Check for variance and const modifiers
    let variance: 'in' | 'out' | 'inout' | undefined;
    let isConst: boolean | undefined;

    const modifiers = ts.getModifiers(tp);
    if (modifiers) {
      let hasIn = false;
      let hasOut = false;
      for (const mod of modifiers) {
        if (mod.kind === ts.SyntaxKind.InKeyword) hasIn = true;
        if (mod.kind === ts.SyntaxKind.OutKeyword) hasOut = true;
        if (mod.kind === ts.SyntaxKind.ConstKeyword) isConst = true;
      }
      if (hasIn && hasOut) variance = 'inout';
      else if (hasIn) variance = 'in';
      else if (hasOut) variance = 'out';
    }

    return {
      name,
      ...(constraint ? { constraint } : {}),
      ...(defaultType ? { default: defaultType } : {}),
      ...(variance ? { variance } : {}),
      ...(isConst ? { const: isConst } : {}),
    };
  });
}

/**
 * Check if a symbol is marked as deprecated via @deprecated JSDoc tag.
 */
export function isSymbolDeprecated(symbol: ts.Symbol | undefined): boolean {
  if (!symbol) {
    return false;
  }

  // Check JSDoc tags on the symbol
  const jsDocTags = symbol.getJsDocTags();
  if (jsDocTags.some((tag) => tag.name.toLowerCase() === 'deprecated')) {
    return true;
  }

  // Check declarations for @deprecated tag
  for (const declaration of symbol.getDeclarations() ?? []) {
    if (ts.getJSDocDeprecatedTag(declaration)) {
      return true;
    }
  }

  return false;
}

/**
 * Get JSDoc comment for a specific signature (overload).
 * Uses signature.getDeclaration() to get the specific overload's declaration.
 */
export function getJSDocForSignature(signature: ts.Signature): {
  description?: string;
  tags: SpecTag[];
  examples: SpecExample[];
} {
  const decl = signature.getDeclaration();
  if (!decl) {
    return { tags: [], examples: [] };
  }
  return getJSDocComment(decl);
}

/**
 * Extract type parameters from a signature (for per-overload type parameters).
 * Uses signature.getTypeParameters() for accurate per-signature extraction.
 */
export function extractTypeParametersFromSignature(
  signature: ts.Signature,
  checker: ts.TypeChecker,
): SpecTypeParameter[] | undefined {
  const typeParams = signature.getTypeParameters();
  if (!typeParams || typeParams.length === 0) {
    return undefined;
  }

  return typeParams.map((tp) => {
    const name = tp.getSymbol()?.getName() ?? 'T';

    // Get constraint
    let constraint: string | undefined;
    const constraintType = tp.getConstraint();
    if (constraintType) {
      constraint = checker.typeToString(constraintType);
    }

    // Get default
    let defaultType: string | undefined;
    const defaultT = tp.getDefault();
    if (defaultT) {
      defaultType = checker.typeToString(defaultT);
    }

    // Check for variance and const modifiers on the declaration
    let variance: 'in' | 'out' | 'inout' | undefined;
    let isConst: boolean | undefined;

    const tpSymbol = tp.getSymbol();
    const declarations = tpSymbol?.getDeclarations() ?? [];
    for (const decl of declarations) {
      if (ts.isTypeParameterDeclaration(decl)) {
        const modifiers = ts.getModifiers(decl);
        if (modifiers) {
          let hasIn = false;
          let hasOut = false;
          for (const mod of modifiers) {
            if (mod.kind === ts.SyntaxKind.InKeyword) hasIn = true;
            if (mod.kind === ts.SyntaxKind.OutKeyword) hasOut = true;
            if (mod.kind === ts.SyntaxKind.ConstKeyword) isConst = true;
          }
          if (hasIn && hasOut) variance = 'inout';
          else if (hasIn) variance = 'in';
          else if (hasOut) variance = 'out';
        }
        break;
      }
    }

    return {
      name,
      ...(constraint ? { constraint } : {}),
      ...(defaultType ? { default: defaultType } : {}),
      ...(variance ? { variance } : {}),
      ...(isConst ? { const: isConst } : {}),
    };
  });
}
