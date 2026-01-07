/**
 * Make a pattern optional
 * @param pattern - The pattern to make optional
 * @returns An optional pattern
 */
export function optional<T>(pattern: T): T | undefined {
  return pattern;
}

/**
 * Match when value satisfies pattern
 * @param pattern - The pattern to check against
 */
export function when<T>(pattern: T): (value: unknown) => boolean {
  return (value: unknown) => value === pattern;
}

/**
 * Constant value for matching
 */
export const DEFAULT_PATTERN = "__DEFAULT__";
