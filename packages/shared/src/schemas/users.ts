import { z } from 'zod';
import { uuidSchema } from './common';

// POST /v1/users/upsert — called by Auth.js on every sign-in (PLAN.md §7.3).
export const upsertUserBodySchema = z.object({
  email: z.email().transform((e) => e.toLowerCase()),
  name: z.string().trim().max(200).nullable().optional(),
  image: z.string().trim().max(2000).nullable().optional(),
});
export type UpsertUserBody = z.input<typeof upsertUserBodySchema>;

export const upsertUserResponseSchema = z.object({
  id: uuidSchema,
  is_admin: z.boolean(),
});
export type UpsertUserResponse = z.infer<typeof upsertUserResponseSchema>;
