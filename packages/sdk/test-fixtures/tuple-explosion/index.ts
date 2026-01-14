/**
 * Test fixture for tuple/array explosion fix
 *
 * These test cases previously caused the schema builder to include
 * all 50+ Array prototype methods (pop, push, toString, etc.) in the output,
 * resulting in thousands of lines of schema for a simple tuple type.
 */

// Empty tuple - should NOT explode into Array methods
export function emptyTuple(items: []): void {
  console.log('Empty tuple:', items);
}

// Simple tuple - should have exactly 2 prefixedItems, NOT Array methods
export function simpleTuple(items: [string, number]): void {
  console.log('Simple tuple:', items);
}

// Tuple with object element
export function tupleWithObject(items: [{ name: string }, number]): void {
  console.log('Tuple with object:', items);
}

// Nested tuple - inner tuple should NOT have Array methods
export type NestedTuple = [[string], [number, boolean]];

export function nestedTuple(items: NestedTuple): void {
  console.log('Nested tuple:', items);
}

// Empty array type - should return simple array schema
export function emptyArray(items: never[]): void {
  console.log('Empty array:', items);
}

// Regular array (should still work normally)
export function regularArray(items: string[]): void {
  console.log('Regular array:', items);
}

// Tuple in return type
export function returnsTuple(): [string, number] {
  return ['hello', 42];
}

// Tuple in object property
export interface ObjectWithTuple {
  coords: [number, number];
  name: string;
}

export function objectWithTuple(obj: ObjectWithTuple): void {
  console.log('Object with tuple:', obj);
}

// Rest tuple
export function restTuple(first: string, ...rest: [number, boolean]): void {
  console.log('Rest tuple:', first, rest);
}

// Optional tuple element (TS 4.0+)
export function optionalTupleElement(items: [string, number?]): void {
  console.log('Optional tuple element:', items);
}
