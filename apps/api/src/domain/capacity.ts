// §14.1 — every condition an order placement must pass. Pure function: the
// caller (Phase 3 service) gathers counts inside a drop-row-locked transaction
// (§14.3) and acts on the returned code.
import type { DropStatus, ErrorCode } from '@farbite/shared';

export interface PlacementDrop {
  status: DropStatus;
  cutoffAt: Date;
  maxOrders: number;
}

export interface PlacementItem {
  qty: number;
  isAvailable: boolean;
  maxQtyPerOrder: number;
  maxTotalQty: number | null;
  /** Sum of qty across active orders for this item (§14.1). */
  soldQty: number;
}

export type PlacementCheck = { ok: true } | { ok: false; code: ErrorCode };

export function checkOrderPlacement(input: {
  drop: PlacementDrop;
  now: Date;
  activeOrders: number;
  items: PlacementItem[];
}): PlacementCheck {
  const { drop, now, activeOrders, items } = input;

  // Never trust status alone (§0.8): status AND cutoff are both checked.
  if (drop.status !== 'open') return { ok: false, code: 'DROP_NOT_OPEN' };
  if (now.getTime() >= drop.cutoffAt.getTime()) return { ok: false, code: 'DROP_NOT_OPEN' };
  if (activeOrders >= drop.maxOrders) return { ok: false, code: 'DROP_FULL' };

  for (const item of items) {
    if (!item.isAvailable) return { ok: false, code: 'ITEM_UNAVAILABLE' };
    if (item.qty > item.maxQtyPerOrder) return { ok: false, code: 'QTY_EXCEEDS_LIMIT' };
    if (item.maxTotalQty !== null && item.soldQty + item.qty > item.maxTotalQty) {
      return { ok: false, code: 'ITEM_SOLD_OUT' };
    }
  }
  return { ok: true };
}
