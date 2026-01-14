/**
 * Test fixture for generic return type handling.
 * Tests that typeArguments are preserved for Promise<T>, Array<T>, etc.
 */

// Custom result type for testing nested generics
export interface Result<T, E = Error> {
  success: boolean;
  data?: T;
  error?: E;
}

// User type for testing
export interface User {
  id: string;
  name: string;
  email: string;
}

// Simple Promise return - should capture User as typeArgument
export async function getUser(id: string): Promise<User> {
  return { id, name: 'Test', email: 'test@example.com' };
}

// Promise with union return
export async function findUser(id: string): Promise<User | null> {
  return null;
}

// Promise with array return - nested generic
export async function getAllUsers(): Promise<User[]> {
  return [];
}

// Promise with custom generic - should capture Result<User>
export async function fetchUser(id: string): Promise<Result<User>> {
  return { success: true, data: { id, name: 'Test', email: 'test@example.com' } };
}

// Deeply nested generics - Promise<Result<Array<User>>>
export async function fetchAllUsers(): Promise<Result<User[]>> {
  return { success: true, data: [] };
}

// Multiple type parameters
export async function fetchUserWithError(id: string): Promise<Result<User, string>> {
  return { success: false, error: 'Not found' };
}

// Non-async function returning Promise
export function getUserLater(id: string): Promise<User> {
  return Promise.resolve({ id, name: 'Test', email: 'test@example.com' });
}

// PromiseLike (not Promise)
export function getUserLike(id: string): PromiseLike<User> {
  return Promise.resolve({ id, name: 'Test', email: 'test@example.com' });
}

// Awaited utility type
export type AwaitedUser = Awaited<Promise<User>>;

// Map and Set with type arguments
export function getUserMap(): Map<string, User> {
  return new Map();
}

export function getUserSet(): Set<User> {
  return new Set();
}

// Iterator types
export function* userGenerator(): Generator<User, void, unknown> {
  yield { id: '1', name: 'Test', email: 'test@example.com' };
}

export async function* asyncUserGenerator(): AsyncGenerator<User, void, unknown> {
  yield { id: '1', name: 'Test', email: 'test@example.com' };
}
