/**
 * Diff two OpenPkg specs
 * Re-exports diff utilities from @openpkg-ts/spec
 */
export {
  diffSpec,
  categorizeBreakingChanges,
  recommendSemverBump,
  calculateNextVersion,
  type SpecDiff,
  type BreakingSeverity,
  type CategorizedBreaking,
  type MemberChangeInfo,
  type SemverBump,
  type SemverRecommendation,
} from '@openpkg-ts/spec';

/**
 * Alias for diffSpec - compare two specs
 */
export { diffSpec as diffSpecs } from '@openpkg-ts/spec';
