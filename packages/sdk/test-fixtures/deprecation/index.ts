/** @deprecated Use newFunction instead */
export function oldFunction() {}

export function newFunction() {}

/** @deprecated Will be removed in v2.0 */
export const legacyConfig = { timeout: 1000 };

/** @deprecated Migrate to NewClient */
export class OldClient {
  connect() {}
}

export class NewClient {
  connect() {}
}
