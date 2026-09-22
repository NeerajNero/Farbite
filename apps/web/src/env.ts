import { z } from 'zod';

// Server-only env (PLAN.md §15 — apps/web). Validated on first import; the
// server fails fast with a readable message. Never import from client components.
const serverEnvSchema = z.object({
  API_BASE_URL: z.string().url(),
  INTERNAL_API_KEY: z.string().min(16, 'INTERNAL_API_KEY must be a long random string (≥16 chars)'),
  // Auth.js (Phase 2)
  AUTH_SECRET: z.string().optional(),
  AUTH_GOOGLE_ID: z.string().optional(),
  AUTH_GOOGLE_SECRET: z.string().optional(),
  AUTH_URL: z.string().url().optional(),
});

function validate<T>(schema: z.ZodType<T>, config: Record<string, unknown>): T {
  const result = schema.safeParse(config);
  if (!result.success) {
    const lines = result.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid environment (apps/web):\n${lines.join('\n')}`);
  }
  return result.data;
}

export const serverEnv = validate(serverEnvSchema, {
  API_BASE_URL: process.env.API_BASE_URL,
  INTERNAL_API_KEY: process.env.INTERNAL_API_KEY,
  AUTH_SECRET: process.env.AUTH_SECRET,
  AUTH_GOOGLE_ID: process.env.AUTH_GOOGLE_ID,
  AUTH_GOOGLE_SECRET: process.env.AUTH_GOOGLE_SECRET,
  AUTH_URL: process.env.AUTH_URL,
});

// NEXT_PUBLIC_* values are inlined at build time; read them directly where needed.
export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? 'Farbite';
