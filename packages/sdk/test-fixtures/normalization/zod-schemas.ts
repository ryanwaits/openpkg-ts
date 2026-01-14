/**
 * Zod schema test fixtures for runtime vs static comparison
 *
 * These schemas allow comparing:
 * 1. Static TypeScript extraction (from type annotations)
 * 2. Runtime schema extraction (from Zod's .toJSONSchema())
 */
import { z } from 'zod';

// ============================================================================
// Basic Schemas
// ============================================================================

/** Simple string schema */
export const StringSchema = z.string();

/** Number with constraints */
export const NumberSchema = z.number().min(0).max(100);

/** Boolean schema */
export const BooleanSchema = z.boolean();

/** Enum schema */
export const RoleSchema = z.enum(['admin', 'user', 'guest']);

// ============================================================================
// Object Schemas
// ============================================================================

/** Simple object schema */
export const PersonSchema = z.object({
  name: z.string(),
  age: z.number().int().positive(),
});

export type Person = z.infer<typeof PersonSchema>;

/** Object with optional fields */
export const ConfigSchema = z.object({
  apiKey: z.string(),
  debug: z.boolean().optional(),
  timeout: z.number().default(5000),
});

export type Config = z.infer<typeof ConfigSchema>;

/** Nested object schema */
export const NestedSchema = z.object({
  user: z.object({
    id: z.string().uuid(),
    profile: z.object({
      bio: z.string().optional(),
      avatar: z.string().url().optional(),
    }),
  }),
  settings: z.object({
    theme: z.enum(['light', 'dark']),
    notifications: z.boolean(),
  }),
});

export type Nested = z.infer<typeof NestedSchema>;

// ============================================================================
// Array Schemas
// ============================================================================

/** Simple array schema */
export const StringArraySchema = z.array(z.string());

/** Array with min/max */
export const BoundedArraySchema = z.array(z.number()).min(1).max(10);

/** Array of objects */
export const UsersArraySchema = z.array(
  z.object({
    id: z.string(),
    email: z.string().email(),
  }),
);

// ============================================================================
// Union and Discriminated Union Schemas
// ============================================================================

/** Simple union */
export const StringOrNumberSchema = z.union([z.string(), z.number()]);

/** Nullable schema */
export const NullableStringSchema = z.string().nullable();

/** Discriminated union */
export const ActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('add'), value: z.number() }),
  z.object({ type: z.literal('remove'), id: z.string() }),
  z.object({ type: z.literal('reset') }),
]);

export type Action = z.infer<typeof ActionSchema>;

// ============================================================================
// Tuple Schemas
// ============================================================================

/** Simple tuple */
export const PointSchema = z.tuple([z.number(), z.number()]);

export type Point = z.infer<typeof PointSchema>;

/** Tuple with different types */
export const MixedTupleSchema = z.tuple([z.string(), z.number(), z.boolean()]);

// ============================================================================
// Record and Map Schemas
// ============================================================================

/** Record schema */
export const StringMapSchema = z.record(z.string(), z.number());

export type StringMap = z.infer<typeof StringMapSchema>;

// ============================================================================
// Complex Real-world Schemas
// ============================================================================

/** API response wrapper */
export const ApiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    data: dataSchema,
    status: z.number().int(),
    message: z.string().optional(),
    timestamp: z.string().datetime(),
  });

/** User schema with all validations */
export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1).max(100),
  age: z.number().int().min(0).max(150).optional(),
  roles: z.array(z.enum(['admin', 'user', 'moderator'])),
  metadata: z.record(z.unknown()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type User = z.infer<typeof UserSchema>;

/** Full API response for users */
export const UserResponseSchema = ApiResponseSchema(UserSchema);
export const UsersListResponseSchema = ApiResponseSchema(z.array(UserSchema));
