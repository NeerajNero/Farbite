import { z } from 'zod';
import { isoDateTimeSchema, optionalTextSchema, uuidSchema } from './common';

// /v1/admin/restaurants (PLAN.md §9.9, §10)

export const restaurantSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  area: z.string().nullable(),
  address: z.string().nullable(),
  phone: z.string().nullable(),
  notes: z.string().nullable(),
  is_active: z.boolean(),
  created_at: isoDateTimeSchema,
  updated_at: isoDateTimeSchema.nullable(),
});
export type Restaurant = z.infer<typeof restaurantSchema>;

export const createRestaurantBodySchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  area: optionalTextSchema,
  address: optionalTextSchema,
  phone: optionalTextSchema,
  notes: optionalTextSchema,
});
export type CreateRestaurantBody = z.input<typeof createRestaurantBodySchema>;

export const updateRestaurantBodySchema = createRestaurantBodySchema
  .partial()
  .extend({ is_active: z.boolean().optional() });
export type UpdateRestaurantBody = z.input<typeof updateRestaurantBodySchema>;
