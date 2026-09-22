// Order lifecycle (PLAN.md §5.2). Valid transitions are exactly these edges —
// anything else is INVALID_TRANSITION (§14.5). expired → payment_submitted is
// the admin "revive" flow (§5.2 bullet, §9.7).
import type { OrderStatus } from '@farbite/shared';

export const ORDER_TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  pending_payment: ['payment_submitted', 'expired', 'cancelled'],
  payment_submitted: ['paid', 'payment_rejected', 'refund_pending'],
  payment_rejected: ['payment_submitted', 'cancelled'],
  paid: ['delivered', 'refund_pending'],
  expired: ['payment_submitted'], // admin revive (capacity must allow)
  refund_pending: ['refunded', 'cancelled'],
  refunded: [],
  cancelled: [],
  delivered: [],
};

export function canTransitionOrder(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from].includes(to);
}

/** §14.2 — statuses that hold capacity (pending_payment only while unexpired). */
export const CAPACITY_HOLDING_STATUSES: readonly OrderStatus[] = [
  'pending_payment',
  'payment_submitted',
  'paid',
];

/** §14.8 — pending orders past expires_at are treated as expired by every reader. */
export function isOrderExpired(order: { status: OrderStatus; expiresAt: Date }, now: Date): boolean {
  return order.status === 'pending_payment' && order.expiresAt.getTime() <= now.getTime();
}

/** §14.2 — does this order currently count toward drop capacity? */
export function isOrderActive(order: { status: OrderStatus; expiresAt: Date }, now: Date): boolean {
  if (order.status === 'pending_payment') return !isOrderExpired(order, now);
  return order.status === 'payment_submitted' || order.status === 'paid';
}

/** Counts as "confirmed" for the public progress bar and restaurant sheet (§5.2). */
export function isOrderConfirmed(status: OrderStatus): boolean {
  return status === 'paid';
}
