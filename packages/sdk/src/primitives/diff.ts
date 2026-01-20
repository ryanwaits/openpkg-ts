/**
 * Diff two OpenPkg specs
 * Re-exports diff utilities from @openpkg-ts/spec
 */
/**
 * Alias for diffSpec - compare two specs
 */
export {
  type BreakingSeverity,
  type CategorizedBreaking,
  type DiffOptions,
  calculateNextVersion,
  categorizeBreakingChanges,
  diffSpec,
  diffSpec as diffSpecs,
  type MemberChangeInfo,
  recommendSemverBump,
  type SemverBump,
  type SemverRecommendation,
  type SpecDiff,
} from '@openpkg-ts/spec';
