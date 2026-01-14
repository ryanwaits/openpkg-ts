/**
 * Test fixtures for variance annotations (in, out, in out) and const type parameters.
 * These are TypeScript 4.7+ features for explicit variance annotations.
 */

// ============================================================================
// Covariant Types (out)
// ============================================================================

/**
 * A producer that only outputs values of type T.
 * Covariant: can substitute Producer<Child> for Producer<Parent>.
 * @typeParam T - The output type (covariant)
 */
export interface Producer<out T> {
  produce(): T;
}

/**
 * Iterator-like interface with covariant type.
 * @typeParam T - The element type (covariant)
 */
export interface Iterable<out T> {
  [Symbol.iterator](): Iterator<T>;
}

// ============================================================================
// Contravariant Types (in)
// ============================================================================

/**
 * A consumer that only accepts values of type T.
 * Contravariant: can substitute Consumer<Parent> for Consumer<Child>.
 * @typeParam T - The input type (contravariant)
 */
export interface Consumer<in T> {
  consume(value: T): void;
}

/**
 * Comparator with contravariant type.
 * @typeParam T - The type being compared (contravariant)
 */
export interface Comparator<in T> {
  compare(a: T, b: T): number;
}

// ============================================================================
// Invariant Types (in out)
// ============================================================================

/**
 * A mutable container that both reads and writes T.
 * Invariant: no substitution allowed.
 * @typeParam T - The stored type (invariant)
 */
export interface MutableContainer<in out T> {
  get(): T;
  set(value: T): void;
}

/**
 * State manager with invariant type.
 * @typeParam S - The state type (invariant)
 */
export interface StateManager<in out S> {
  getState(): S;
  setState(state: S): void;
  updateState(updater: (prev: S) => S): void;
}

// ============================================================================
// Const Type Parameters
// ============================================================================

/**
 * Create a readonly tuple from arguments.
 * The const modifier preserves literal types.
 * @typeParam T - Inferred as readonly tuple type
 */
export function tuple<const T extends readonly unknown[]>(...args: T): T {
  return args;
}

/**
 * Create a typed config object.
 * Const preserves literal property types.
 * @typeParam T - Config object type with literal values
 */
export function defineConfig<const T extends Record<string, unknown>>(config: T): Readonly<T> {
  return Object.freeze(config);
}

/**
 * Class with const type parameter.
 * @typeParam T - Literal type preserved by const
 */
export class ConstantHolder<const T> {
  constructor(public readonly value: T) {}
}

// ============================================================================
// Mixed Variance Annotations
// ============================================================================

/**
 * Function type with contravariant input and covariant output.
 * @typeParam In - Input type (contravariant)
 * @typeParam Out - Output type (covariant)
 */
export type Transform<in In, out Out> = (input: In) => Out;

/**
 * Event handler with multiple variance annotations.
 * @typeParam E - Event type (contravariant)
 * @typeParam R - Result type (covariant)
 */
export interface EventHandler<in E, out R> {
  handle(event: E): R;
}

// ============================================================================
// Class with Variance Annotations
// ============================================================================

/**
 * Generic class with covariant type parameter.
 * @typeParam T - The value type (covariant)
 */
export class Box<out T> {
  constructor(private readonly _value: T) {}

  get value(): T {
    return this._value;
  }
}

/**
 * Generic class with contravariant type parameter.
 * @typeParam T - The handler type (contravariant)
 */
export class Handler<in T> {
  constructor(private readonly _handler: (value: T) => void) {}

  handle(value: T): void {
    this._handler(value);
  }
}
