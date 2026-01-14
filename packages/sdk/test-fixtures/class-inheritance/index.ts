/**
 * Test fixtures for class inheritance member extraction.
 * Tests inherited instance members, static members, and overridden members.
 */

// ============================================================================
// Base Classes
// ============================================================================

/**
 * Base class with various member types.
 */
export class BaseClass {
  /** Base instance property */
  public baseProperty: string = 'base';

  /** Protected property (should be inherited) */
  protected protectedProperty: number = 42;

  /** Static property on base */
  static staticBaseProperty: string = 'static-base';

  /** Static method on base */
  static staticBaseMethod(): string {
    return 'static-base';
  }

  /**
   * Base method that will be inherited.
   * @param value - The input value
   * @returns The processed result
   */
  public baseMethod(value: string): string {
    return value.toUpperCase();
  }

  /**
   * Method that will be overridden in child.
   */
  public overriddenMethod(): string {
    return 'base';
  }

  /** Getter in base class */
  get baseGetter(): number {
    return 100;
  }
}

/**
 * Intermediate class in inheritance chain.
 */
export class MiddleClass extends BaseClass {
  /** Property defined in middle class */
  public middleProperty: boolean = false;

  /**
   * Method defined in middle class.
   */
  public middleMethod(): void {
    // no-op
  }
}

// ============================================================================
// Derived Classes
// ============================================================================

/**
 * Child class that extends BaseClass.
 * Should inherit baseProperty, protectedProperty, baseMethod, baseGetter.
 * Should NOT inherit privateProperty.
 */
export class ChildClass extends BaseClass {
  /** Child's own property */
  public childProperty: number = 123;

  /**
   * Override of base method.
   */
  public override overriddenMethod(): string {
    return 'child';
  }

  /** Child's own method */
  public childMethod(): boolean {
    return true;
  }
}

/**
 * Grandchild class demonstrating multi-level inheritance.
 * Should inherit from both MiddleClass and BaseClass.
 */
export class GrandchildClass extends MiddleClass {
  /** Grandchild's own property */
  public grandchildProperty: string = 'grandchild';
}

// ============================================================================
// Static Inheritance
// ============================================================================

/**
 * Class with inherited static members.
 */
export class StaticChild extends BaseClass {
  /** Child's own static property */
  static childStaticProperty: number = 999;

  /** Child's own static method */
  static childStaticMethod(): void {
    // no-op
  }
}
