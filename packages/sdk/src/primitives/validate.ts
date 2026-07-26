/**
 * Validate an OpenPkg spec against a versioned meta-schema.
 * Re-exports validation utilities from @openpkg-ts/spec so consumers (and the
 * CLI) reach them through the single @openpkg-ts/sdk entry point.
 */
export {
  assertSpec,
  getAvailableVersions,
  getValidationErrors,
  LATEST_VERSION,
  type SchemaVersion,
  type SpecError,
  validateSpec,
} from '@openpkg-ts/spec';
