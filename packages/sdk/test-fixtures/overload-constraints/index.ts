/**
 * Test fixtures for per-overload type parameter constraints.
 * Each overload can have different type parameter constraints.
 */

// ============================================================================
// Function with Different Constraints per Overload
// ============================================================================

/**
 * Process an array of numbers.
 * @typeParam T - Must extend number
 */
export function process<T extends number>(items: T[]): T;
/**
 * Process an array of strings.
 * @typeParam T - Must extend string
 */
export function process<T extends string>(items: T[]): T;
/**
 * Implementation.
 */
export function process<T extends number | string>(items: T[]): T {
  return items[0];
}

// ============================================================================
// Overloads with Different Default Types
// ============================================================================

/**
 * Create a container with string default.
 * @typeParam T - Container type, defaults to string
 */
export function createContainer<T = string>(): { value: T | null };
/**
 * Create a container with initial value.
 * @typeParam T - Container type inferred from value
 */
export function createContainer<T>(initial: T): { value: T };
export function createContainer<T>(initial?: T): { value: T | null } {
  return { value: initial ?? null };
}

// ============================================================================
// Interface Method with Different Constraints
// ============================================================================

/**
 * Generic processor interface.
 */
export interface Processor {
  /**
   * Execute with serializable constraint.
   * @typeParam T - Must have toJSON method
   */
  execute<T extends { toJSON(): string }>(data: T): string;
  /**
   * Execute with numeric constraint.
   * @typeParam T - Must extend number
   */
  execute<T extends number>(data: T): number;
}

// ============================================================================
// Class with Overloaded Generic Methods
// ============================================================================

/**
 * Builder class with constrained overloads.
 */
export class Builder {
  /**
   * Build from an object with id.
   * @typeParam T - Object with string id
   */
  build<T extends { id: string }>(source: T): T & { built: true };
  /**
   * Build from a primitive.
   * @typeParam T - Primitive type
   */
  build<T extends string | number | boolean>(source: T): { value: T; built: true };
  build<T>(source: T): object {
    if (typeof source === 'object' && source !== null) {
      return { ...source, built: true };
    }
    return { value: source, built: true };
  }
}
