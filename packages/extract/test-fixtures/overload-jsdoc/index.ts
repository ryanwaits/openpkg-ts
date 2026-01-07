/**
 * Test fixtures for per-overload JSDoc extraction.
 * Each overload should have its own description, tags, and examples.
 */

// ============================================================================
// Function Overloads with Per-Overload JSDoc
// ============================================================================

/**
 * Parse a value to a number.
 * @param value - String value to parse
 * @returns The parsed integer
 * @example
 * ```ts
 * parse("42") // returns 42
 * ```
 */
export function parse(value: string): number;
/**
 * Parse a value with radix.
 * @param value - String value to parse
 * @param radix - The base to use (2-36)
 * @returns The parsed integer in the given base
 * @example
 * ```ts
 * parse("ff", 16) // returns 255
 * ```
 */
export function parse(value: string, radix: number): number;
/**
 * Implementation signature.
 */
export function parse(value: string, radix?: number): number {
  return parseInt(value, radix ?? 10);
}

// ============================================================================
// Interface with Method Overloads
// ============================================================================

/**
 * Interface demonstrating method overload JSDoc.
 */
export interface Formatter {
  /**
   * Format a number to string.
   * @param value - The number to format
   */
  format(value: number): string;
  /**
   * Format a date to string.
   * @param value - The date to format
   * @param locale - Optional locale string
   */
  format(value: Date, locale?: string): string;
}

// ============================================================================
// Class with Method Overloads
// ============================================================================

/**
 * Class demonstrating method overload JSDoc.
 */
export class Converter {
  /**
   * Convert string to number.
   * @param input - The string input
   * @returns Numeric value
   */
  convert(input: string): number;
  /**
   * Convert number to string.
   * @param input - The number input
   * @returns String representation
   */
  convert(input: number): string;
  /**
   * Implementation.
   */
  convert(input: string | number): string | number {
    if (typeof input === 'string') {
      return Number(input);
    }
    return String(input);
  }
}

// ============================================================================
// Generic Overloads
// ============================================================================

/**
 * Create a single item array.
 * @typeParam T - The item type
 * @param item - Single item
 * @returns Array containing the item
 */
export function toArray<T>(item: T): T[];
/**
 * Create an array from spread items.
 * @typeParam T - The items type
 * @param items - Multiple items
 * @returns Array of all items
 */
export function toArray<T>(...items: T[]): T[];
export function toArray<T>(...items: T[]): T[] {
  return items;
}
