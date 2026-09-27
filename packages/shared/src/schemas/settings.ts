import { z } from 'zod';
import { PAYMENT_PROVIDERS } from '../enums';

// GET /v1/admin/settings — read-only env display (PLAN.md §9.10)
export const adminSettingsSchema = z.object({
  payment_provider: z.enum(PAYMENT_PROVIDERS),
  upi_vpa: z.string().nullable(),
  upi_payee_name: z.string().nullable(),
  admin_emails: z.array(z.string()),
  order_expiry_minutes: z.int(),
  app_base_url: z.string().nullable(),
  support_whatsapp: z.string().nullable(),
});
export type AdminSettings = z.infer<typeof adminSettingsSchema>;
