import { checkOrderPlacement, type PlacementItem } from './capacity.js';

const now = new Date('2026-10-02T12:00:00Z');
const openDrop = {
  status: 'open' as const,
  cutoffAt: new Date('2026-10-02T15:30:00Z'),
  maxOrders: 40,
};
const okItem: PlacementItem = {
  qty: 2,
  isAvailable: true,
  maxQtyPerOrder: 5,
  maxTotalQty: null,
  soldQty: 0,
};

describe('checkOrderPlacement (§14.1, §14.2, §0.8)', () => {
  it('accepts a valid placement', () => {
    expect(
      checkOrderPlacement({ drop: openDrop, now, activeOrders: 10, items: [okItem] }),
    ).toEqual({ ok: true });
  });

  it('rejects when drop is not open, regardless of cutoff', () => {
    for (const status of ['draft', 'closed', 'confirmed', 'cancelled'] as const) {
      expect(
        checkOrderPlacement({ drop: { ...openDrop, status }, now, activeOrders: 0, items: [okItem] }),
      ).toEqual({ ok: false, code: 'DROP_NOT_OPEN' });
    }
  });

  it('rejects past cutoff even while status is still open (never trust status alone)', () => {
    const atCutoff = new Date(openDrop.cutoffAt);
    expect(
      checkOrderPlacement({ drop: openDrop, now: atCutoff, activeOrders: 0, items: [okItem] }),
    ).toEqual({ ok: false, code: 'DROP_NOT_OPEN' });
  });

  it('rejects at capacity (active = pending-unexpired + submitted + paid)', () => {
    expect(
      checkOrderPlacement({ drop: openDrop, now, activeOrders: 40, items: [okItem] }),
    ).toEqual({ ok: false, code: 'DROP_FULL' });
    expect(
      checkOrderPlacement({ drop: openDrop, now, activeOrders: 39, items: [okItem] }),
    ).toEqual({ ok: true });
  });

  it('rejects unavailable items', () => {
    expect(
      checkOrderPlacement({
        drop: openDrop,
        now,
        activeOrders: 0,
        items: [{ ...okItem, isAvailable: false }],
      }),
    ).toEqual({ ok: false, code: 'ITEM_UNAVAILABLE' });
  });

  it('rejects qty above per-order limit', () => {
    expect(
      checkOrderPlacement({
        drop: openDrop,
        now,
        activeOrders: 0,
        items: [{ ...okItem, qty: 6 }],
      }),
    ).toEqual({ ok: false, code: 'QTY_EXCEEDS_LIMIT' });
  });

  it('rejects when max_total_qty would be exceeded; null means unlimited', () => {
    expect(
      checkOrderPlacement({
        drop: openDrop,
        now,
        activeOrders: 0,
        items: [{ ...okItem, maxTotalQty: 10, soldQty: 9, qty: 2 }],
      }),
    ).toEqual({ ok: false, code: 'ITEM_SOLD_OUT' });
    expect(
      checkOrderPlacement({
        drop: openDrop,
        now,
        activeOrders: 0,
        items: [{ ...okItem, maxTotalQty: 10, soldQty: 8, qty: 2 }],
      }),
    ).toEqual({ ok: true });
    expect(
      checkOrderPlacement({
        drop: openDrop,
        now,
        activeOrders: 0,
        items: [{ ...okItem, maxTotalQty: null, soldQty: 999, qty: 5 }],
      }),
    ).toEqual({ ok: true });
  });
});
