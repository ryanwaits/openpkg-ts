import type {
  OpenPkg,
  SpecExport,
  SpecGenerationInfo,
  SpecMember,
  SpecTag,
  SpecType,
} from './types';

const DEFAULT_ECOSYSTEM = 'js/ts';

const arrayFieldsByExport: Array<keyof SpecExport> = ['signatures', 'members', 'examples', 'tags'];
const arrayFieldsByType: Array<keyof SpecType> = ['members', 'tags'];

export function normalize(spec: OpenPkg): OpenPkg {
  const normalized: OpenPkg = structuredClone(spec);

  normalized.meta = {
    ecosystem: normalized.meta?.ecosystem ?? DEFAULT_ECOSYSTEM,
    ...normalized.meta,
  };

  normalized.exports = Array.isArray(normalized.exports) ? [...normalized.exports] : [];
  normalized.exports.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  normalized.exports = normalized.exports.map((item) => normalizeExport(item));

  const types = Array.isArray(normalized.types) ? [...normalized.types] : [];
  types.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  normalized.types = types.map((item) => normalizeType(item));

  // Normalize generation metadata to match schema
  if (normalized.generation) {
    normalized.generation = normalizeGeneration(normalized.generation);
  }

  return normalized;
}

/**
 * Normalize generation metadata to match schema.
 * Schema expects generator to be a string, not an object.
 */
function normalizeGeneration(gen: OpenPkg['generation']): OpenPkg['generation'] {
  if (!gen) return undefined;

  // If it has the extended SpecGenerationInfo structure
  const extendedGen = gen as SpecGenerationInfo;
  if (extendedGen.generator && typeof extendedGen.generator === 'object') {
    // Convert to minimal SpecGenerationMeta format
    return {
      generator: `${extendedGen.generator.name}@${extendedGen.generator.version}`,
      timestamp: extendedGen.timestamp,
    };
  }

  return gen;
}

function normalizeEntry<T extends SpecExport | SpecType>(item: T, arrayFields: Array<keyof T>): T {
  const clone: T = structuredClone(item);

  for (const field of arrayFields) {
    if (!Array.isArray(clone[field] as unknown)) {
      (clone as Record<string, unknown>)[field as string] = [];
    }
  }

  if (clone.type !== undefined && typeof clone.type !== 'string') {
    if (!clone.schema) {
      clone.schema = clone.type;
    }
    delete clone.type;
  }

  if (clone.tags && clone.tags.length > 0) {
    clone.tags = clone.tags.map(normalizeTag);
  }

  if (clone.members && clone.members.length > 0) {
    clone.members = clone.members.map(normalizeMember);
  }

  return clone;
}

const normalizeExport = (item: SpecExport) => normalizeEntry(item, arrayFieldsByExport);
const normalizeType = (item: SpecType) => normalizeEntry(item, arrayFieldsByType);

/**
 * Normalize a tag to only have known fields.
 */
function normalizeTag(tag: SpecTag & Record<string, unknown>): SpecTag {
  const result: SpecTag = {
    name: tag.name,
    text: tag.text,
  };
  if (tag.param) {
    result.param = tag.param;
  }
  if (tag.inlineTags && tag.inlineTags.length > 0) {
    result.inlineTags = tag.inlineTags;
  }
  return result;
}

/**
 * Normalize a member - fix tags and nested structures.
 */
function normalizeMember(member: SpecMember): SpecMember {
  const clone: SpecMember = structuredClone(member);

  // Normalize tags
  if (clone.tags && clone.tags.length > 0) {
    clone.tags = clone.tags.map(normalizeTag);
  }

  return clone;
}
