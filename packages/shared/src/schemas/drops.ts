import { z } from 'zod';
import { DROP_STATUSES } from '../enums';
import { isoDateTimeSchema, optionalTextSchema, paiseSchema, uuidSchema } from './common';

// /v1/admin/drops (PLAN.md §9.1, §9.2, §10). Customer-facing drop DTOs arrive
// in Phase 3 (GET /drops/current) and reuse the item/delivery-point shapes.

// ---- Items -----------------------------------------------------------------

export const dropItemInputSchema = z.object({
  /** Present when editing an existing item; absent for a new row. */
  id: uuidSchema.optional(),
  name: z.string().trim().min(1, 'Item name is required').max(200),
  description: optionalTextSchema,
  price_paise: paiseSchema,
  cost_price_paise: paiseSchema.nullable().optional(),
  is_veg: z.boolean().default(true),
  max_qty_per_order: z.int().min(1).default(5),
  max_total_qty: z.int().min(0).nullable().optional(),
  sort_order: z.int().default(0),
  is_available: z.boolean().default(true),
});
export type DropItemInput = z.input<typeof dropItemInputSchema>;

export const dropItemSchema = z.object({
  id: uuidSchema,
  drop_id: uuidSchema,
  name: z.string(),
  description: z.string().nullable(),
  price_paise: paiseSchema,
  cost_price_paise: paiseSchema.nullable(),
  is_veg: z.boolean(),
  max_qty_per_order: z.int(),
  max_total_qty: z.int().nullable(),
  sort_order: z.int(),
  is_available: z.boolean(),
  /** Qty across capacity-holding orders (§14.1 sold_qty). */
  sold_qty: z.int(),
});
export type DropItem = z.infer<typeof dropItemSchema>;

// ---- Counts ----------------------------------------------------------------

/**
 * Order counts for a drop. `capacity_used` follows §14.2 (pending not yet
 * expired + submitted + paid). `paid` includes delivered orders (they were
 * paid) so post-delivery numbers don't drop to zero.
 */
export const dropCountsSchema = z.object({
  paid: z.int(),
  submitted: z.int(),
  pending: z.int(),
  expired_or_rejected: z.int(),
  delivered: z.int(),
  capacity_used: z.int(),
  min_orders: z.int(),
  max_orders: z.int(),
});
export type DropCounts = z.infer<typeof dropCountsSchema>;

// ---- Drop ------------------------------------------------------------------

const dropBaseSchema = z.object({
  id: uuidSchema,
  restaurant_id: uuidSchema,
  restaurant_name: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  status: z.enum(DROP_STATUSES),
  cutoff_at: isoDateTimeSchema,
  delivery_starts_at: isoDateTimeSchema,
  delivery_ends_at: isoDateTimeSchema,
  min_orders: z.int(),
  max_orders: z.int(),
  delivery_fee_paise: paiseSchema,
  customer_notes: z.string().nullable(),
  internal_notes: z.string().nullable(),
  opened_at: isoDateTimeSchema.nullable(),
  closed_at: isoDateTimeSchema.nullable(),
  confirmed_at: isoDateTimeSchema.nullable(),
  out_for_delivery_at: isoDateTimeSchema.nullable(),
  delivered_at: isoDateTimeSchema.nullable(),
  cancelled_at: isoDateTimeSchema.nullable(),
  cancel_reason: z.string().nullable(),
  created_at: isoDateTimeSchema,
  updated_at: isoDateTimeSchema.nullable(),
  counts: dropCountsSchema,
});

/** Row in GET /admin/drops. */
export const dropListItemSchema = dropBaseSchema;
export type DropListItem = z.infer<typeof dropListItemSchema>;

/** GET /admin/drops/:id — full drop with items and served delivery points. */
export const dropSchema = dropBaseSchema.extend({
  items: z.array(dropItemSchema),
  delivery_points: z.array(
    z.object({ id: uuidSchema, name: z.string(), area: z.string().nullable(), is_active: z.boolean() }),
  ),
});
export type Drop = z.infer<typeof dropSchema>;

// ---- Create / update -------------------------------------------------------

const dropFieldsSchema = z.object({
  restaurant_id: uuidSchema,
  title: z.string().trim().min(1, 'Title is required').max(200),
  description: optionalTextSchema,
  cutoff_at: isoDateTimeSchema,
  delivery_starts_at: isoDateTimeSchema,
  delivery_ends_at: isoDateTimeSchema,
  min_orders: z.int().min(0),
  max_orders: z.int().min(1),
  delivery_fee_paise: paiseSchema.default(0),
  customer_notes: optionalTextSchema,
  internal_notes: optionalTextSchema,
  delivery_point_ids: z.array(uuidSchema),
  items: z.array(dropItemInputSchema),
});

function checkDropDates(
  d: {
    cutoff_at?: string | undefined;
    delivery_starts_at?: string | undefined;
    delivery_ends_at?: string | undefined;
    min_orders?: number | undefined;
    max_orders?: number | undefined;
  },
  ctx: z.RefinementCtx,
): void {
  if (d.delivery_starts_at && d.delivery_ends_at && d.delivery_ends_at <= d.delivery_starts_at) {
    ctx.addIssue({ code: 'custom', path: ['delivery_ends_at'], message: 'Delivery window must end after it starts' });
  }
  if (d.cutoff_at && d.delivery_starts_at && d.cutoff_at >= d.delivery_starts_at) {
    ctx.addIssue({ code: 'custom', path: ['cutoff_at'], message: 'Cutoff must be before delivery starts' });
  }
  if (d.min_orders !== undefined && d.max_orders !== undefined && d.min_orders > d.max_orders) {
    ctx.addIssue({ code: 'custom', path: ['min_orders'], message: 'Min orders cannot exceed max orders' });
  }
}

export const createDropBodySchema = dropFieldsSchema.superRefine(checkDropDates);
export type CreateDropBody = z.input<typeof createDropBodySchema>;

/**
 * PATCH /admin/drops/:id. Which keys are accepted depends on drop status
 * (§9.1 editing rules) — enforced server-side in the drops service.
 * `items`: rows with `id` update that item, rows without `id` are new, and
 * (in draft) existing items missing from the array are deleted.
 */
export const updateDropBodySchema = dropFieldsSchema.partial().superRefine(checkDropDates);
export type UpdateDropBody = z.input<typeof updateDropBodySchema>;

// ---- Transition ------------------------------------------------------------

export const transitionDropBodySchema = z.object({
  to: z.enum(DROP_STATUSES),
  /** Required for `cancelled`; acts as override_reason for `confirmed` (§14.6). */
  reason: z.string().trim().max(500).optional(),
});
export type TransitionDropBody = z.input<typeof transitionDropBodySchema>;

// ---- Dashboard -------------------------------------------------------------

export const DROP_FUNNEL_STEPS = [
  'drop_viewed',
  'checkout_started',
  'order_placed',
  'utr_submitted',
  'payment_verified',
] as const;
export type DropFunnelStep = (typeof DROP_FUNNEL_STEPS)[number];

export const dropDashboardSchema = z.object({
  drop_id: uuidSchema,
  counts: dropCountsSchema,
  /** Sum of total_paise over paid (incl. delivered) orders. */
  revenue_paise: paiseSchema,
  /** revenue − food cost (cost_price × qty); null when any paid item lacks a cost price. */
  estimated_margin_paise: z.int().nullable(),
  funnel: z.record(z.enum(DROP_FUNNEL_STEPS), z.int()),
});
export type DropDashboard = z.infer<typeof dropDashboardSchema>;
