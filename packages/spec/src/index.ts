export * from './constants';
export { dereference } from './deref';
export {
  isStringSchema,
  isNumberSchema,
  isBooleanSchema,
  isIntegerSchema,
  isNullSchema,
  isVoidSchema,
  isNeverSchema,
  isAnySchema,
  isObjectSchema,
  isArraySchema,
  isTupleSchema,
  isFunctionSchema,
  isAnyOfSchema,
  isAllOfSchema,
  isOneOfSchema,
  isRefSchema,
} from './guards';
export { resolveRef, flattenAnyOf, getSchemaType } from './schema-utils';
export {
  type BreakingSeverity,
  type CategorizedBreaking,
  calculateNextVersion,
  categorizeBreakingChanges,
  type DiffOptions,
  diffSpec,
  type MemberChangeInfo,
  recommendSemverBump,
  type SemverBump,
  type SemverRecommendation,
  type SpecDiff,
} from './diff';
export { normalize } from './normalize';
export * from './types';
export {
  assertSpec,
  getAvailableVersions,
  getValidationErrors,
  validateSpec,
} from './validate';
