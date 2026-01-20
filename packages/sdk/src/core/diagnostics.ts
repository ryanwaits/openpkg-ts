import type { OpenPkg, SpecExport, SpecMember, SpecSignature, SpecTag } from '@openpkg-ts/spec';

export interface DiagnosticItem {
  exportId: string;
  exportName: string;
  issue: string;
  /** Member name if issue is on a member */
  member?: string;
  /** Parameter name if issue is on a parameter */
  param?: string;
}

export interface SpecDiagnostics {
  /** Exports/members without descriptions */
  missingDescriptions: DiagnosticItem[];
  /** Exports marked @deprecated but no reason provided */
  deprecatedNoReason: DiagnosticItem[];
  /** Function params without descriptions in JSDoc */
  missingParamDocs: DiagnosticItem[];
}

/**
 * Check if export has @deprecated tag.
 */
export function hasDeprecatedTag(exp: SpecExport): boolean {
  if (exp.deprecated === true) return true;
  return exp.tags?.some((t) => t.name === 'deprecated' || t.name === '@deprecated') ?? false;
}

/**
 * Get deprecation message from @deprecated tag.
 * Returns undefined if no reason provided.
 */
export function getDeprecationMessage(exp: SpecExport): string | undefined {
  const tag = exp.tags?.find((t) => t.name === 'deprecated' || t.name === '@deprecated');
  if (tag && tag.text.trim()) {
    return tag.text.trim();
  }
  return undefined;
}

/**
 * Find params without descriptions in JSDoc.
 */
export function findMissingParamDocs(exp: SpecExport): string[] {
  const missing: string[] = [];

  for (const sig of exp.signatures ?? []) {
    for (const param of sig.parameters ?? []) {
      if (!param.description?.trim()) {
        missing.push(param.name);
      }
    }
  }

  return missing;
}

function checkMemberDescriptions(
  exp: SpecExport,
  members: SpecMember[],
): DiagnosticItem[] {
  const items: DiagnosticItem[] = [];
  for (const member of members) {
    if (!member.description?.trim() && member.name) {
      items.push({
        exportId: exp.id,
        exportName: exp.name,
        issue: 'member missing description',
        member: member.name,
      });
    }
  }
  return items;
}

/**
 * Analyze a spec for quality issues.
 */
export function analyzeSpec(spec: OpenPkg): SpecDiagnostics {
  const missingDescriptions: DiagnosticItem[] = [];
  const deprecatedNoReason: DiagnosticItem[] = [];
  const missingParamDocs: DiagnosticItem[] = [];

  for (const exp of spec.exports) {
    // Check export description
    if (!exp.description?.trim()) {
      missingDescriptions.push({
        exportId: exp.id,
        exportName: exp.name,
        issue: 'missing description',
      });
    }

    // Check member descriptions
    if (exp.members) {
      missingDescriptions.push(...checkMemberDescriptions(exp, exp.members));
    }

    // Check deprecated without reason
    if (hasDeprecatedTag(exp) && !getDeprecationMessage(exp)) {
      deprecatedNoReason.push({
        exportId: exp.id,
        exportName: exp.name,
        issue: 'deprecated without reason',
      });
    }

    // Check param docs
    const missingParams = findMissingParamDocs(exp);
    for (const param of missingParams) {
      missingParamDocs.push({
        exportId: exp.id,
        exportName: exp.name,
        issue: 'param missing description',
        param,
      });
    }
  }

  return {
    missingDescriptions,
    deprecatedNoReason,
    missingParamDocs,
  };
}
