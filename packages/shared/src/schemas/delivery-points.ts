import { z } from 'zod';
import { isoDateTimeSchema, optionalTextSchema, uuidSchema } from './common';

// /v1/admin/delivery-points — PGs (PLAN.md §9.9, §10)

export const deliveryPointSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  area: z.string().nullable(),
  landmark: z.string().nullable(),
  handover_notes: z.string().nullable(),
  sort_order: z.int(),
  is_active: z.boolean(),
  created_at: isoDateTimeSchema,
  updated_at: isoDateTimeSchema.nullable(),
});
export type DeliveryPoint = z.infer<typeof deliveryPointSchema>;

export const createDeliveryPointBodySchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  area: optionalTextSchema,
  landmark: optionalTextSchema,
  handover_notes: optionalTextSchema,
  sort_order: z.int().optional(),
});
export type CreateDeliveryPointBody = z.input<typeof createDeliveryPointBodySchema>;

export const updateDeliveryPointBodySchema = createDeliveryPointBodySchema
  .partial()
  .extend({ is_active: z.boolean().optional() });
export type UpdateDeliveryPointBody = z.input<typeof updateDeliveryPointBodySchema>;
