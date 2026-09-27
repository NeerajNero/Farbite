// PLAN.md §9.1 editing rules — pure, unit-tested. The service builds a
// snapshot of the current drop and asks whether a PATCH body is allowed.
//
//   draft   — everything editable
//   open    — description / notes / max_orders (≥ capacity used) / cutoff (later
//             only) / per-item is_available + max_total_qty (≥ sold); no new
//             items, no removals, no price changes
//   closed+ — read-only except notes
import type { DropStatus, UpdateDropBody } from '@farbite/shared';

export interface DropItemSnapshot {
  id: string;
  name: string;
  description: string | null;
  price_paise: number;
  cost_price_paise: number | null;
  is_veg: boolean;
  max_qty_per_order: number;
  max_total_qty: number | null;
  sort_order: number;
  is_available: boolean;
  sold_qty: number;
}

export interface DropSnapshot {
  status: DropStatus;
  restaurant_id: string;
  title: string;
  description: string | null;
  cutoff_at: string; // ISO
  delivery_starts_at: string;
  delivery_ends_at: string;
  min_orders: number;
  max_orders: number;
  delivery_fee_paise: number;
  customer_notes: string | null;
  internal_notes: string | null;
  delivery_point_ids: string[];
  items: DropItemSnapshot[];
  capacity_used: number;
}

export type EditCheck =
  { ok: true } | { ok: false; message: string; path?: string };

type ScalarKey = Exclude<keyof UpdateDropBody, 'items' | 'delivery_point_ids'>;
const SCALAR_KEYS: readonly ScalarKey[] = [
  'restaurant_id',
  'title',
  'description',
  'cutoff_at',
  'delivery_starts_at',
  'delivery_ends_at',
  'min_orders',
  'max_orders',
  'delivery_fee_paise',
  'customer_notes',
  'internal_notes',
];

const OPEN_SCALARS: ReadonlySet<ScalarKey> = new Set<ScalarKey>([
  'description',
  'customer_notes',
  'internal_notes',
  'max_orders',
  'cutoff_at',
]);
const CLOSED_SCALARS: ReadonlySet<ScalarKey> = new Set<ScalarKey>([
  'customer_notes',
  'internal_notes',
]);

/** Item fields that may still change while the drop is open. */
type ItemKey = keyof Omit<DropItemSnapshot, 'id' | 'sold_qty'>;
const OPEN_ITEM_KEYS: ReadonlySet<ItemKey> = new Set<ItemKey>([
  'is_available',
  'max_total_qty',
  'description',
  'cost_price_paise',
  'sort_order',
]);
const ALL_ITEM_KEYS: readonly ItemKey[] = [
  'name',
  'description',
  'price_paise',
  'cost_price_paise',
  'is_veg',
  'max_qty_per_order',
  'max_total_qty',
  'sort_order',
  'is_available',
];

function same(a: unknown, b: unknown): boolean {
  const na = a ?? null;
  const nb = b ?? null;
  if (
    typeof na === 'string' &&
    typeof nb === 'string' &&
    isIso(na) &&
    isIso(nb)
  ) {
    return new Date(na).getTime() === new Date(nb).getTime();
  }
  return na === nb;
}
function isIso(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T/.test(s);
}

export function validateDropPatch(
  current: DropSnapshot,
  patch: UpdateDropBody,
): EditCheck {
  if (current.status === 'draft') return checkItemIds(current, patch);

  const allowed = current.status === 'open' ? OPEN_SCALARS : CLOSED_SCALARS;
  const label =
    current.status === 'open'
      ? 'while the drop is open'
      : `once the drop is ${current.status}`;

  for (const key of SCALAR_KEYS) {
    if (!(key in patch) || patch[key] === undefined) continue;
    if (allowed.has(key)) continue;
    if (!same(patch[key], current[key])) {
      return { ok: false, path: key, message: `Cannot change ${key} ${label}` };
    }
  }

  if (patch.delivery_point_ids !== undefined) {
    const a = [...patch.delivery_point_ids].sort();
    const b = [...current.delivery_point_ids].sort();
    if (a.length !== b.length || a.some((v, i) => v !== b[i])) {
      return {
        ok: false,
        path: 'delivery_point_ids',
        message: `Cannot change delivery points ${label}`,
      };
    }
  }

  if (current.status === 'open') {
    if (
      patch.max_orders !== undefined &&
      patch.max_orders < current.capacity_used
    ) {
      return {
        ok: false,
        path: 'max_orders',
        message: `max_orders must be at least the ${current.capacity_used} orders already holding capacity`,
      };
    }
    if (
      patch.cutoff_at !== undefined &&
      new Date(patch.cutoff_at) < new Date(current.cutoff_at)
    ) {
      return {
        ok: false,
        path: 'cutoff_at',
        message: 'Cutoff can only be moved later while the drop is open',
      };
    }
  }

  if (patch.items === undefined) return { ok: true };

  const byId = new Map(current.items.map((i) => [i.id, i]));
  const seen = new Set<string>();
  for (const [idx, row] of patch.items.entries()) {
    if (!row.id)
      return {
        ok: false,
        path: `items.${idx}`,
        message: `Cannot add items ${label}`,
      };
    const existing = byId.get(row.id);
    if (!existing)
      return { ok: false, path: `items.${idx}.id`, message: 'Unknown item id' };
    seen.add(row.id);

    for (const key of ALL_ITEM_KEYS) {
      if (!(key in row) || row[key] === undefined) continue;
      if (current.status === 'open' && OPEN_ITEM_KEYS.has(key)) continue;
      if (!same(row[key], existing[key])) {
        return {
          ok: false,
          path: `items.${idx}.${key}`,
          message: `Cannot change item ${key} ${label}`,
        };
      }
    }
    if (
      current.status === 'open' &&
      row.max_total_qty !== undefined &&
      row.max_total_qty !== null &&
      row.max_total_qty < existing.sold_qty
    ) {
      return {
        ok: false,
        path: `items.${idx}.max_total_qty`,
        message: `max_total_qty for "${existing.name}" must be at least the ${existing.sold_qty} already sold`,
      };
    }
  }
  if (seen.size !== current.items.length) {
    return {
      ok: false,
      path: 'items',
      message: `Cannot remove items ${label}`,
    };
  }
  return { ok: true };
}

/** Draft: any shape is fine, but item ids must belong to this drop. */
function checkItemIds(current: DropSnapshot, patch: UpdateDropBody): EditCheck {
  if (!patch.items) return { ok: true };
  const ids = new Set(current.items.map((i) => i.id));
  for (const [idx, row] of patch.items.entries()) {
    if (row.id && !ids.has(row.id)) {
      return { ok: false, path: `items.${idx}.id`, message: 'Unknown item id' };
    }
  }
  return { ok: true };
}

/** Preconditions for draft → open (§5.1, §14.13 checked separately in the service). */
export function canPublishDrop(input: {
  itemCount: number;
  deliveryPointCount: number;
  cutoffAt: Date;
  now: Date;
}): EditCheck {
  if (input.itemCount === 0)
    return { ok: false, message: 'Add at least one item before publishing' };
  if (input.deliveryPointCount === 0) {
    return {
      ok: false,
      message: 'Select at least one delivery point before publishing',
    };
  }
  if (input.cutoffAt <= input.now)
    return { ok: false, message: 'Cutoff is already in the past' };
  return { ok: true };
}
