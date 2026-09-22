import { z } from 'zod';

export const healthResponseSchema = z.object({
  ok: z.literal(true),
  db: z.boolean(),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;
