import { DROP_STATUSES } from '@farbite/shared';
import {
  canConfirmDrop,
  canTransitionDrop,
  orderStatusOnDropCancel,
} from './drop-state-machine.js';

describe('drop state machine (§5.1, §14.5)', () => {
  const valid: Array<[string, string]> = [
    ['draft', 'open'],
    ['open', 'closed'],
    ['open', 'cancelled'],
    ['closed', 'confirmed'],
    ['closed', 'cancelled'],
    ['confirmed', 'out_for_delivery'],
    ['out_for_delivery', 'delivered'],
  ];

  it.each(valid)('allows %s → %s', (from, to) => {
    expect(canTransitionDrop(from as never, to as never)).toBe(true);
  });

  it('rejects every edge not in §5.1', () => {
    const validSet = new Set(valid.map(([f, t]) => `${f}→${t}`));
    for (const from of DROP_STATUSES) {
      for (const to of DROP_STATUSES) {
        if (!validSet.has(`${from}→${to}`)) {
          expect(canTransitionDrop(from, to), `${from}→${to}`).toBe(false);
        }
      }
    }
  });

  it('terminal states have no exits', () => {
    for (const to of DROP_STATUSES) {
      expect(canTransitionDrop('delivered', to)).toBe(false);
      expect(canTransitionDrop('cancelled', to)).toBe(false);
    }
  });
});

describe('canConfirmDrop (§14.6)', () => {
  it('allows when paid ≥ min', () => {
    expect(canConfirmDrop({ paidCount: 10, minOrders: 10 })).toBe(true);
    expect(canConfirmDrop({ paidCount: 11, minOrders: 10 })).toBe(true);
  });
  it('blocks when paid < min without override', () => {
    expect(canConfirmDrop({ paidCount: 9, minOrders: 10 })).toBe(false);
    expect(canConfirmDrop({ paidCount: 9, minOrders: 10, overrideReason: '   ' })).toBe(false);
  });
  it('allows below min with a typed override reason', () => {
    expect(
      canConfirmDrop({ paidCount: 9, minOrders: 10, overrideReason: 'restaurant confirmed anyway' }),
    ).toBe(true);
  });
});

describe('orderStatusOnDropCancel (§14.7)', () => {
  it('paid and payment_submitted → refund_pending', () => {
    expect(orderStatusOnDropCancel('paid')).toBe('refund_pending');
    expect(orderStatusOnDropCancel('payment_submitted')).toBe('refund_pending');
  });
  it('pending_payment and payment_rejected → cancelled', () => {
    expect(orderStatusOnDropCancel('pending_payment')).toBe('cancelled');
    expect(orderStatusOnDropCancel('payment_rejected')).toBe('cancelled');
  });
  it('other statuses are unaffected', () => {
    for (const s of ['expired', 'cancelled', 'refund_pending', 'refunded', 'delivered'] as const) {
      expect(orderStatusOnDropCancel(s)).toBeNull();
    }
  });
});
