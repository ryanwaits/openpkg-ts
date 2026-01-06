/**
 * Test module for Standard JSON Schema extraction
 */
import { z } from 'zod';

export const UserSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  email: z.string().email(),
  age: z.number().int().min(0).optional(),
  role: z.enum(['admin', 'user', 'guest']),
});

export const ConfigSchema = z.object({
  host: z.string(),
  port: z.number().min(1).max(65535),
  ssl: z.boolean(),
});

// Schema with transform (input differs from output)
export const CreateUserInput = z.object({
  name: z.string(),
  email: z.string().email(),
}).transform((data) => ({
  ...data,
  id: 'generated-id',
  createdAt: new Date().toISOString(),
}));
