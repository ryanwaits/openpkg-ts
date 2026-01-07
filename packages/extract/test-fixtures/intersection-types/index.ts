/**
 * Test fixture for intersection type handling.
 * Tests that intersection types are properly preserved as allOf schemas.
 */

// Base types for intersection
export interface User {
  id: string;
  name: string;
}

export interface Role {
  role: 'admin' | 'user' | 'guest';
  permissions: string[];
}

export interface Timestamps {
  createdAt: Date;
  updatedAt: Date;
}

// Simple intersection of two types
export type UserWithRole = User & { role: string };

// Branded type pattern (common in type-safe ID handling)
export type Branded<A, K extends string> = A & { __brand: K };

// Multiple branded types
export type UserId = Branded<string, 'UserId'>;
export type PostId = Branded<string, 'PostId'>;

// Three-way intersection
export type Combined = User & Role & Timestamps;

// Intersection with inline object type
export type UserWithMetadata = User & {
  metadata: Record<string, unknown>;
  version: number;
};

// Degenerate case: single type intersection (should collapse)
export type SingleIntersection = User & {};

// Function using intersection types
export function mergeUserRole(user: User, role: Role): User & Role {
  return { ...user, ...role };
}

// Function with branded type parameter
export function getUserById(id: UserId): User | null {
  return null;
}
