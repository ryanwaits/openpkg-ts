/**
 * Test fixture for cross-package type references.
 * Tests that external types include x-ts-package extension with package name.
 *
 * @see https://trpc.io/docs/v11/quickstart
 */

// Note: This fixture demonstrates the pattern for cross-package type references.
// In a real scenario with @trpc/server installed, you would have:
//
// import type { AnyRouter } from '@trpc/server';
// export function createClient<TRouter extends AnyRouter>(): void;
//
// For testing without the dependency, we simulate the pattern:

// Simulated external type (in real usage, this would come from a package)
export interface ExternalRouter {
  _def: {
    procedures: Record<string, unknown>;
  };
}

// Function using an external-like type constraint
export function createClient<TRouter extends ExternalRouter>(): {
  router: TRouter;
} {
  return {} as { router: TRouter };
}

// Another pattern: using types that would come from external packages
export interface RequestContext {
  req: unknown;
  res: unknown;
}

export function createContext<TContext extends RequestContext>(factory: () => TContext): TContext {
  return factory();
}

// Type that extends from what would be an external package
export interface CustomRouter extends ExternalRouter {
  customField: string;
}

// Utility function that works with external types
export function isValidRouter(value: unknown): value is ExternalRouter {
  return (
    typeof value === 'object' &&
    value !== null &&
    '_def' in value &&
    typeof (value as ExternalRouter)._def === 'object'
  );
}

/**
 * Example function with @see tag containing a full URL.
 * The URL should be preserved with its https:// prefix.
 *
 * @see https://trpc.io/docs/v11/quickstart
 * @see https://github.com/trpc/trpc
 */
export function example(): void {
  // Implementation
}
