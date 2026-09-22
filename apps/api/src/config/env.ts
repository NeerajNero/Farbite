import { z } from 'zod';

// Env contract (PLAN.md §15). Validated at boot; the process refuses to start
// on a bad env with a readable message.
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),

  // Required since Phase 1 (except NODE_ENV=test — e2e tests run without a DB).
  DATABASE_URL: z.string().min(1).optional(),

  INTERNAL_API_KEY: z.string().min(16, 'INTERNAL_API_KEY must be a long random string (≥16 chars)'),
  ADMIN_EMAILS: z
    .string()
    .default('')
    .transform((v) =>
      v
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean),
    ),

  PAYMENT_PROVIDER: z.enum(['manual_upi', 'razorpay']).default('manual_upi'),
  UPI_VPA: z.string().optional(),
  UPI_PAYEE_NAME: z.string().optional(),
  SUPPORT_WHATSAPP: z.string().regex(/^91\d{10}$/, 'SUPPORT_WHATSAPP must be 91XXXXXXXXXX').optional(),
  ORDER_EXPIRY_MINUTES: z.coerce.number().int().positive().default(45),
  APP_BASE_URL: z.string().url().optional(),

  // Phase 7
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    const lines = result.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid environment:\n${lines.join('\n')}`);
  }
  if (result.data.NODE_ENV !== 'test' && !result.data.DATABASE_URL) {
    throw new Error('Invalid environment:\n  - DATABASE_URL: required (Phase 1+)');
  }
  return result.data;
}
