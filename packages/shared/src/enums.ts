// Postgres enums (PLAN.md §6) — single source of truth, mirrored in Drizzle in Phase 1.

export const DROP_STATUSES = [
  'draft',
  'open',
  'closed',
  'confirmed',
  'out_for_delivery',
  'delivered',
  'cancelled',
] as const;
export type DropStatus = (typeof DROP_STATUSES)[number];

export const ORDER_STATUSES = [
  'pending_payment',
  'payment_submitted',
  'paid',
  'payment_rejected',
  'expired',
  'cancelled',
  'refund_pending',
  'refunded',
  'delivered',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_PROVIDERS = ['manual_upi', 'razorpay'] as const;
export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number];

export const PAYMENT_STATUSES = [
  'pending',
  'submitted',
  'verified',
  'rejected',
  'refund_pending',
  'refunded',
  'failed',
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

// Error codes the web app switches on (PLAN.md §10).
export const ERROR_CODES = [
  'DROP_NOT_OPEN',
  'DROP_FULL',
  'ITEM_SOLD_OUT',
  'ITEM_UNAVAILABLE',
  'QTY_EXCEEDS_LIMIT',
  'ORDER_EXPIRED',
  'ORDER_NOT_PENDING',
  'UTR_INVALID',
  'UTR_ALREADY_USED',
  'INVALID_TRANSITION',
  'NOT_FOUND',
  'RATE_LIMITED',
  'FORBIDDEN',
  'UNAUTHORIZED',
  'VALIDATION_ERROR',
  'INTERNAL',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];
