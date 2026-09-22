// Drop lifecycle (PLAN.md §5.1). Valid transitions are exactly these edges —
// anything else is INVALID_TRANSITION (§14.5).
import type { DropStatus, OrderStatus } from '@farbite/shared';

export const DROP_TRANSITIONS: Readonly<Record<DropStatus, readonly DropStatus[]>> = {
  draft: ['open'],
  open: ['closed', 'cancelled'],
  closed: ['confirmed', 'cancelled'],
  confirmed: ['out_for_delivery'],
  out_for_delivery: ['delivered'],
  delivered: [],
  cancelled: [],
};

export function canTransitionDrop(from: DropStatus, to: DropStatus): boolean {
  return DROP_TRANSITIONS[from].includes(to);
}

/** Timestamp column recorded on each transition (§5.1). */
export const DROP_TRANSITION_TIMESTAMP: Readonly<Partial<Record<DropStatus, string>>> = {
  open: 'openedAt',
  closed: 'closedAt',
  confirmed: 'confirmedAt',
  out_for_delivery: 'outForDeliveryAt',
  delivered: 'deliveredAt',
  cancelled: 'cancelledAt',
};

/** §14.6 — closed → confirmed requires paid ≥ min unless an override reason is given. */
export function canConfirmDrop(input: {
  paidCount: number;
  minOrders: number;
  overrideReason?: string | undefined;
}): boolean {
  if (input.paidCount >= input.minOrders) return true;
  return typeof input.overrideReason === 'string' && input.overrideReason.trim().length > 0;
}

/**
 * §14.7 — what happens to each order when its drop is cancelled.
 * Returns the new order status, or null if the order is unaffected.
 */
export function orderStatusOnDropCancel(status: OrderStatus): OrderStatus | null {
  switch (status) {
    case 'paid':
    case 'payment_submitted':
      return 'refund_pending';
    case 'pending_payment':
    case 'payment_rejected':
      return 'cancelled';
    default:
      return null;
  }
}
