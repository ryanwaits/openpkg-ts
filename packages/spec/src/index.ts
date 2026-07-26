export * from './constants';
export { dereference } from './deref';
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
export {
  isAllOfSchema,
  isAnyOfSchema,
  isAnySchema,
  isArraySchema,
  isBooleanSchema,
  isFunctionSchema,
  isIntegerSchema,
  isNeverSchema,
  isNullSchema,
  isNumberSchema,
  isObjectSchema,
  isOneOfSchema,
  isRefSchema,
  isStringSchema,
  isTupleSchema,
  isVoidSchema,
} from './guards';
export { normalize } from './normalize';
export { flattenAnyOf, getSchemaType, resolveRef } from './schema-utils';
export * from './types';
export {
  assertSpec,
  getAvailableVersions,
  getValidationErrors,
  LATEST_VERSION,
  type SchemaVersion,
  type SpecError,
  validateSpec,
} from './validate';
