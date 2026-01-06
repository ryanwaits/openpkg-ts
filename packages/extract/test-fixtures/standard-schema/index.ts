/**
 * Test fixture for Standard JSON Schema verification
 */
import { z } from 'zod';

// Zod v4 schema
export const UserSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  email: z.string().email(),
  age: z.number().int().min(0).optional(),
  role: z.enum(['admin', 'user', 'guest']),
});

export type User = z.infer<typeof UserSchema>;

// Nested schema with transform
export const CreateUserInput = z.object({
  name: z.string(),
  email: z.string().email(),
  password: z.string().min(8),
}).transform((data) => ({
  ...data,
  id: crypto.randomUUID(),
  createdAt: new Date(),
}));

export type CreateUserInputType = z.input<typeof CreateUserInput>;
export type CreateUserOutputType = z.output<typeof CreateUserInput>;

// Regular function using schema
export function validateUser(data: unknown): User {
  return UserSchema.parse(data);
}

// Array schema
export const UsersListSchema = z.array(UserSchema);

export type UsersList = z.infer<typeof UsersListSchema>;
