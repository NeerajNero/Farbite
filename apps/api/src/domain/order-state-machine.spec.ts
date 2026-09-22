import { ORDER_STATUSES } from '@farbite/shared';
import {
  canTransitionOrder,
  isOrderActive,
  isOrderConfirmed,
  isOrderExpired,
} from './order-state-machine.js';

describe('order state machine (§5.2, §14.5)', () => {
  const valid: Array<[string, string]> = [
    ['pending_payment', 'payment_submitted'],
    ['pending_payment', 'expired'],
    ['pending_payment', 'cancelled'],
    ['payment_submitted', 'paid'],
    ['payment_submitted', 'payment_rejected'],
    ['payment_submitted', 'refund_pending'],
    ['payment_rejected', 'payment_submitted'],
    ['payment_rejected', 'cancelled'],
    ['paid', 'delivered'],
    ['paid', 'refund_pending'],
    ['expired', 'payment_submitted'], // admin revive
    ['refund_pending', 'refunded'],
    ['refund_pending', 'cancelled'],
  ];

  it.each(valid)('allows %s → %s', (from, to) => {
    expect(canTransitionOrder(from as never, to as never)).toBe(true);
  });

  it('rejects every edge not in §5.2', () => {
    const validSet = new Set(valid.map(([f, t]) => `${f}→${t}`));
    for (const from of ORDER_STATUSES) {
      for (const to of ORDER_STATUSES) {
        if (!validSet.has(`${from}→${to}`)) {
          expect(canTransitionOrder(from, to), `${from}→${to}`).toBe(false);
        }
      }
    }
  });
});

describe('expiry + capacity membership (§14.2, §14.8)', () => {
  const now = new Date('2026-10-02T12:00:00Z');
  const future = new Date('2026-10-02T12:45:00Z');
  const past = new Date('2026-10-02T11:00:00Z');

  it('pending order before expires_at is active, after is expired (lazy)', () => {
    expect(isOrderActive({ status: 'pending_payment', expiresAt: future }, now)).toBe(true);
    expect(isOrderActive({ status: 'pending_payment', expiresAt: past }, now)).toBe(false);
    expect(isOrderExpired({ status: 'pending_payment', expiresAt: past }, now)).toBe(true);
    // boundary: expires_at ≤ now counts as expired
    expect(isOrderExpired({ status: 'pending_payment', expiresAt: now }, now)).toBe(true);
  });

  it('payment_submitted and paid hold capacity regardless of expires_at', () => {
    expect(isOrderActive({ status: 'payment_submitted', expiresAt: past }, now)).toBe(true);
    expect(isOrderActive({ status: 'paid', expiresAt: past }, now)).toBe(true);
  });

  it('nothing else holds capacity', () => {
    for (const s of [
      'expired',
      'cancelled',
      'payment_rejected',
      'refund_pending',
      'refunded',
      'delivered',
    ] as const) {
      expect(isOrderActive({ status: s, expiresAt: future }, now)).toBe(false);
    }
  });

  it('only paid counts as confirmed (progress bar / restaurant sheet)', () => {
    for (const s of ORDER_STATUSES) {
      expect(isOrderConfirmed(s)).toBe(s === 'paid');
    }
  });
});
