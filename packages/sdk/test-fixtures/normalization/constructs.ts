/**
 * Test fixtures for JSON Schema normalization
 *
 * This file contains various TypeScript constructs that test the normalizer's
 * ability to convert SpecSchema DSL to valid JSON Schema 2020-12.
 */

// ============================================================================
// 1. Primitive Types
// ============================================================================

/** Standard string type */
export const stringPrimitive: string = 'hello';

/** Standard number type */
export const numberPrimitive: number = 42;

/** Standard boolean type */
export const booleanPrimitive: boolean = true;

/** BigInt type (maps to integer with x-ts-type) */
export const bigintPrimitive: bigint = 9007199254740991n;

/** Symbol type (maps to string with x-ts-type) */
export const symbolPrimitive: symbol = Symbol('test');

// ============================================================================
// 2. TypeScript-Specific Types
// ============================================================================

/** Void return type (maps to null) */
export function voidReturn(): void {
  // no return
}

/** Never type (maps to not {}) */
export function neverReturn(): never {
  throw new Error('never');
}

/** Any type (maps to empty schema) */
export const anyType: any = {};

/** Unknown type (maps to empty schema) */
export const unknownType: unknown = {};

/** Undefined type (maps to null) */
export const undefinedType: undefined = undefined;

// ============================================================================
// 3. Function Types
// ============================================================================

/** Simple function with parameters and return */
export function simpleFunction(x: number, y: string): boolean {
  return x > 0 && y.length > 0;
}

/** Function with optional parameter */
export function optionalParam(x: number, y?: string): string {
  return y || String(x);
}

/** Function with rest parameter */
export function restParams(...args: number[]): number {
  return args.reduce((a, b) => a + b, 0);
}

/** Overloaded function */
export function overloaded(x: string): string;
export function overloaded(x: number): number;
export function overloaded(x: string | number): string | number {
  return x;
}

/** Arrow function type */
export const arrowFn: (x: number) => string = (x) => String(x);

// ============================================================================
// 4. Generic Types
// ============================================================================

/** Promise type (uses $ref with typeArguments) */
export async function asyncReturn(): Promise<string> {
  return 'async';
}

/** Array type */
export const arrayType: Array<number> = [1, 2, 3];

/** Generic interface */
export interface Container<T> {
  value: T;
  getValue(): T;
}

/** Generic function */
export function identity<T>(x: T): T {
  return x;
}

// ============================================================================
// 5. Interface and Class Constructs
// ============================================================================

/** Simple interface with properties */
export interface SimpleInterface {
  id: string;
  name: string;
  count: number;
}

/** Interface with optional members */
export interface OptionalMembers {
  required: string;
  optional?: number;
}

/** Interface with methods */
export interface WithMethods {
  getValue(): string;
  setValue(value: string): void;
  process(input: number, options?: { debug: boolean }): Promise<string>;
}

/** Interface with getters/setters */
export interface WithAccessors {
  get value(): number;
  set value(v: number);
  readonly readonlyProp: string;
}

/** Interface with index signature */
export interface StringMap {
  [key: string]: number;
  knownKey: number;
}

/** Interface with call signature (callable interface) */
export interface Callable {
  (x: number): string;
  name: string;
}

/** Class with various members */
export class SimpleClass {
  public id: string;
  private _value: number;
  protected status: string;

  constructor(id: string) {
    this.id = id;
    this._value = 0;
    this.status = 'active';
  }

  get value(): number {
    return this._value;
  }

  set value(v: number) {
    this._value = v;
  }

  public increment(): void {
    this._value++;
  }
}

// ============================================================================
// 6. Union and Intersection Types
// ============================================================================

/** Simple union type */
export type StringOrNumber = string | number;

/** Union with null (nullable) */
export type Nullable<T> = T | null;

/** Discriminated union */
export type Action =
  | { type: 'add'; value: number }
  | { type: 'remove'; id: string }
  | { type: 'reset' };

/** Intersection type */
export type Combined = { a: string } & { b: number };

// ============================================================================
// 7. Tuple Types
// ============================================================================

/** Simple tuple */
export type Point = [number, number];

/** Named tuple */
export type NamedTuple = [x: number, y: number, label?: string];

/** Tuple with rest */
export type TupleWithRest = [string, ...number[]];

// ============================================================================
// 8. Enum Types
// ============================================================================

/** Numeric enum */
export enum NumericEnum {
  First,
  Second,
  Third,
}

/** String enum */
export enum StringEnum {
  A = 'a',
  B = 'b',
  C = 'c',
}

/** Const enum */
export enum ConstEnum {
  X = 1,
  Y = 2,
}

// ============================================================================
// 9. Complex/Nested Types
// ============================================================================

/** Deeply nested object */
export interface DeepNested {
  level1: {
    level2: {
      level3: {
        value: string;
        items: Array<{ id: number; tags: string[] }>;
      };
    };
  };
}

/** Recursive type */
export interface TreeNode {
  value: string;
  children?: TreeNode[];
}

/** Type with all special primitives */
export interface AllSpecialTypes {
  bigintField: bigint;
  symbolField: symbol;
  voidCallback: () => void;
  neverField?: never;
  anyField: any;
  unknownField: unknown;
}

// ============================================================================
// 10. Real-world Examples
// ============================================================================

/** API response type */
export interface ApiResponse<T> {
  data: T;
  status: number;
  message?: string;
  timestamp: Date;
}

/** User entity */
export interface User {
  id: string;
  email: string;
  name: string;
  age?: number;
  roles: string[];
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

/** Event handler type */
export type EventHandler<E = Event> = (event: E) => void | Promise<void>;

/** Configuration object */
export interface Config {
  debug: boolean;
  apiUrl: string;
  timeout: number;
  retry: {
    attempts: number;
    delay: number;
    backoff: 'linear' | 'exponential';
  };
  hooks?: {
    onSuccess?: () => void;
    onError?: (error: Error) => void;
  };
}
