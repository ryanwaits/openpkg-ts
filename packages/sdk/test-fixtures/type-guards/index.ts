/**
 * Test fixture for type guard (type predicate) handling.
 * Tests that type guards preserve their narrowing information.
 */

// Simple type guard for primitive
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

// Type guard for number
export function isNumber(value: unknown): value is number {
  return typeof value === 'number';
}

// Type guard for array
export function isArray<T>(value: unknown): value is T[] {
  return Array.isArray(value);
}

// Type guard for null/undefined
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

// Type guard for object type
export interface User {
  id: string;
  name: string;
  email: string;
}

export function isUser(value: unknown): value is User {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'name' in value &&
    'email' in value
  );
}

// Higher-order type guard (returns a type guard function)
export function isMatching<P>(pattern: P): (value: unknown) => value is P {
  return (value: unknown): value is P => {
    // Simplified pattern matching
    return JSON.stringify(value) === JSON.stringify(pattern);
  };
}

// Type guard with union narrowing
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

export function isOk<T, E>(result: Result<T, E>): result is { ok: true; value: T } {
  return result.ok === true;
}

export function isError<T, E>(result: Result<T, E>): result is { ok: false; error: E } {
  return result.ok === false;
}

// Assertion function (different from type guard but related)
export function assertIsString(value: unknown): asserts value is string {
  if (typeof value !== 'string') {
    throw new Error('Expected string');
  }
}
