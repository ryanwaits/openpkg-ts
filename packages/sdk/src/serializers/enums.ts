import type { SpecExport, SpecMember, SpecSchema } from '@openpkg-ts/spec';
import type ts from 'typescript';
import { getJSDocComment, isSymbolDeprecated } from '../ast/utils';
import type { SerializerContext } from './context';
import { extractExportMetadata } from './shared';

export function serializeEnum(node: ts.EnumDeclaration, ctx: SerializerContext): SpecExport | null {
  const { typeChecker: checker } = ctx;
  const symbol = checker.getSymbolAtLocation(node.name ?? node);
  const name = symbol?.getName() ?? node.name?.getText();
  if (!name) return null;

  const { description, tags, examples, source, deprecated, deprecationReason, inlineTags } =
    extractExportMetadata(node, symbol, checker);

  const members: SpecMember[] = node.members.map((member) => {
    const memberSymbol = checker.getSymbolAtLocation(member.name);
    const memberName = memberSymbol?.getName() ?? member.name.getText();

    // Get the constant value
    const constantValue = checker.getConstantValue(member);

    // Build schema based on value type
    let schema: SpecSchema | undefined;
    if (typeof constantValue === 'string') {
      schema = { type: 'string', enum: [constantValue] };
    } else if (typeof constantValue === 'number') {
      schema = { type: 'number', enum: [constantValue] };
    } else if (member.initializer) {
      // Computed value - fall back to expression text
      schema = { type: member.initializer.getText() };
    }

    // Enum members carry the same doc metadata as any other member: a
    // description, tags, and — most importantly — deprecation. The
    // @deprecated tag is the one signal telling a reader to stop using a value.
    const {
      description: memberDesc,
      tags: memberTags,
      inlineTags: memberInlineTags,
    } = getJSDocComment(member);
    const { deprecated, reason: deprecationReason } = isSymbolDeprecated(memberSymbol);

    return {
      id: memberName,
      name: memberName,
      kind: 'enum-member',
      ...(schema ? { schema } : {}),
      ...(memberDesc ? { description: memberDesc } : {}),
      ...(memberTags.length > 0 ? { tags: memberTags } : {}),
      ...(memberInlineTags ? { inlineTags: memberInlineTags } : {}),
      ...(deprecated ? { deprecated: true, deprecationReason } : {}),
    };
  });

  return {
    id: name,
    name,
    kind: 'enum',
    description,
    tags,
    source,
    members,
    ...(deprecated ? { deprecated: true, deprecationReason } : {}),
    ...(examples.length > 0 ? { examples } : {}),
    ...(inlineTags ? { inlineTags } : {}),
  };
}
