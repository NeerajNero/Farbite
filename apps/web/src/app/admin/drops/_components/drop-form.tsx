"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  isoToIstLocal,
  istLocalToIso,
  toIST,
  type CreateDropBody,
  type DeliveryPoint,
  type Drop,
  type DropItemInput,
  type Restaurant,
  type UpdateDropBody,
} from "@farbite/shared";
import { createDrop, updateDrop } from "../_actions";
import { editabilityFor } from "../_libs/drop-transitions";
import {
  buttonClass,
  ErrorBox,
  Field,
  inputClass,
  secondaryButtonClass,
} from "@/components/admin/ui";

type ItemRow = {
  key: string;
  id?: string;
  name: string;
  description: string;
  price: string; // ₹ as typed
  cost: string; // ₹ as typed, '' = none
  is_veg: boolean;
  max_qty_per_order: string;
  max_total_qty: string; // '' = unlimited
  is_available: boolean;
};

type Props = {
  mode: "create" | "edit";
  initial?: Drop;
  restaurants: Restaurant[];
  deliveryPoints: DeliveryPoint[];
};

let keySeq = 0;
const newKey = () => `k${++keySeq}`;

/** ₹ text → integer paise (the one place rupee input is converted). */
function rupeesToPaise(value: string): number | null {
  if (value.trim() === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}
const paiseToRupees = (paise: number | null) =>
  paise === null ? "" : String(paise / 100);

function emptyItem(): ItemRow {
  return {
    key: newKey(),
    name: "",
    description: "",
    price: "",
    cost: "",
    is_veg: true,
    max_qty_per_order: "5",
    max_total_qty: "",
    is_available: true,
  };
}

function rowFromItem(item: Drop["items"][number]): ItemRow {
  return {
    key: newKey(),
    id: item.id,
    name: item.name,
    description: item.description ?? "",
    price: paiseToRupees(item.price_paise),
    cost: paiseToRupees(item.cost_price_paise),
    is_veg: item.is_veg,
    max_qty_per_order: String(item.max_qty_per_order),
    max_total_qty:
      item.max_total_qty === null ? "" : String(item.max_total_qty),
    is_available: item.is_available,
  };
}

/** Default cutoff (§9.1): delivery date − 1 day, 21:00 IST. */
function defaultCutoff(deliveryLocal: string): string {
  const day = deliveryLocal.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return "";
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return `${d.toISOString().slice(0, 10)}T21:00`;
}

function suggestTitle(
  restaurantName: string | undefined,
  deliveryLocal: string,
): string {
  const iso = istLocalToIso(deliveryLocal);
  if (!restaurantName || !iso) return restaurantName ?? "";
  return `${restaurantName} — ${toIST(iso, { weekday: "short", day: "numeric", month: "short" })}`;
}

const optionalText = (s: string) => (s.trim() === "" ? null : s.trim());

export function DropForm({
  mode,
  initial,
  restaurants,
  deliveryPoints,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<{
    message: string;
    details?: { path: string; message: string }[];
  } | null>(null);
  const can = editabilityFor(initial?.status);

  const activeRestaurants = restaurants.filter(
    (r) => r.is_active || r.id === initial?.restaurant_id,
  );
  const activePoints = deliveryPoints.filter(
    (p) => p.is_active || initial?.delivery_points.some((dp) => dp.id === p.id),
  );

  const [restaurantId, setRestaurantId] = useState(
    initial?.restaurant_id ?? activeRestaurants[0]?.id ?? "",
  );
  const [title, setTitle] = useState(initial?.title ?? "");
  const [titleTouched, setTitleTouched] = useState(mode === "edit");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [deliveryStart, setDeliveryStart] = useState(
    initial ? isoToIstLocal(initial.delivery_starts_at) : "",
  );
  const [deliveryEnd, setDeliveryEnd] = useState(
    initial ? isoToIstLocal(initial.delivery_ends_at) : "",
  );
  const [cutoff, setCutoff] = useState(
    initial ? isoToIstLocal(initial.cutoff_at) : "",
  );
  const [cutoffTouched, setCutoffTouched] = useState(mode === "edit");
  const [minOrders, setMinOrders] = useState(String(initial?.min_orders ?? 10));
  const [maxOrders, setMaxOrders] = useState(String(initial?.max_orders ?? 40));
  const [deliveryFee, setDeliveryFee] = useState(
    paiseToRupees(initial?.delivery_fee_paise ?? 0),
  );
  const [customerNotes, setCustomerNotes] = useState(
    initial?.customer_notes ?? "",
  );
  const [internalNotes, setInternalNotes] = useState(
    initial?.internal_notes ?? "",
  );
  const [pointIds, setPointIds] = useState<string[]>(
    initial
      ? initial.delivery_points.map((p) => p.id)
      : deliveryPoints.filter((p) => p.is_active).map((p) => p.id),
  );
  const [items, setItems] = useState<ItemRow[]>(
    initial ? initial.items.map(rowFromItem) : [emptyItem()],
  );

  const restaurantName = activeRestaurants.find(
    (r) => r.id === restaurantId,
  )?.name;

  function onRestaurantChange(id: string) {
    setRestaurantId(id);
    if (!titleTouched)
      setTitle(
        suggestTitle(
          activeRestaurants.find((r) => r.id === id)?.name,
          deliveryStart,
        ),
      );
  }
  function onDeliveryStartChange(v: string) {
    setDeliveryStart(v);
    if (!titleTouched) setTitle(suggestTitle(restaurantName, v));
    if (!cutoffTouched) setCutoff(defaultCutoff(v));
    if (!deliveryEnd && v) {
      // default 90-minute window
      const iso = istLocalToIso(v);
      if (iso)
        setDeliveryEnd(
          isoToIstLocal(new Date(new Date(iso).getTime() + 90 * 60_000)),
        );
    }
  }

  function updateItem(key: string, patch: Partial<ItemRow>) {
    setItems((rows) =>
      rows.map((r) => (r.key === key ? { ...r, ...patch } : r)),
    );
  }

  function buildItems(): DropItemInput[] | { error: string } {
    const out: DropItemInput[] = [];
    for (const [i, row] of items.entries()) {
      const price = rupeesToPaise(row.price);
      if (price === null) return { error: `Item ${i + 1}: price is required` };
      const cost = row.cost.trim() === "" ? null : rupeesToPaise(row.cost);
      if (row.cost.trim() !== "" && cost === null)
        return { error: `Item ${i + 1}: invalid cost price` };
      const maxPer = Number(row.max_qty_per_order);
      const maxTotal =
        row.max_total_qty.trim() === "" ? null : Number(row.max_total_qty);
      const item: DropItemInput = {
        name: row.name,
        description: optionalText(row.description),
        price_paise: price,
        cost_price_paise: cost,
        is_veg: row.is_veg,
        max_qty_per_order: Number.isInteger(maxPer) ? maxPer : 5,
        max_total_qty:
          maxTotal !== null && Number.isInteger(maxTotal) ? maxTotal : null,
        sort_order: i,
        is_available: row.is_available,
      };
      if (row.id) item.id = row.id;
      out.push(item);
    }
    return out;
  }

  function submit() {
    setError(null);
    const builtItems = buildItems();
    if ("error" in builtItems) {
      setError({ message: builtItems.error });
      return;
    }
    const cutoffIso = istLocalToIso(cutoff);
    const startIso = istLocalToIso(deliveryStart);
    const endIso = istLocalToIso(deliveryEnd);
    const fee = rupeesToPaise(deliveryFee);

    let body: CreateDropBody | UpdateDropBody;
    if (can.all) {
      if (!cutoffIso || !startIso || !endIso) {
        setError({ message: "Delivery window and cutoff are required" });
        return;
      }
      body = {
        restaurant_id: restaurantId,
        title,
        description: optionalText(description),
        cutoff_at: cutoffIso,
        delivery_starts_at: startIso,
        delivery_ends_at: endIso,
        min_orders: Number(minOrders),
        max_orders: Number(maxOrders),
        delivery_fee_paise: fee ?? 0,
        customer_notes: optionalText(customerNotes),
        internal_notes: optionalText(internalNotes),
        delivery_point_ids: pointIds,
        items: builtItems,
      } satisfies CreateDropBody;
    } else if (can.openFields) {
      if (!cutoffIso) {
        setError({ message: "Cutoff is required" });
        return;
      }
      body = {
        description: optionalText(description),
        customer_notes: optionalText(customerNotes),
        internal_notes: optionalText(internalNotes),
        max_orders: Number(maxOrders),
        cutoff_at: cutoffIso,
        items: builtItems,
      } satisfies UpdateDropBody;
    } else {
      body = {
        customer_notes: optionalText(customerNotes),
        internal_notes: optionalText(internalNotes),
      } satisfies UpdateDropBody;
    }

    startTransition(async () => {
      const result =
        mode === "create"
          ? await createDrop(body)
          : await updateDrop(initial!.id, body);
      if (result.ok && "id" in result) {
        router.push(`/admin/drops/${result.id}`);
        router.refresh();
      } else if (!result.ok) {
        setError(
          result.details
            ? { message: result.message, details: result.details }
            : { message: result.message },
        );
      }
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="space-y-6"
    >
      <section className="grid gap-3 sm:grid-cols-2">
        <Field label="Restaurant">
          <select
            value={restaurantId}
            onChange={(e) => onRestaurantChange(e.target.value)}
            disabled={!can.all}
            required
            className={inputClass}
          >
            {activeRestaurants.length === 0 && (
              <option value="">— add a restaurant first —</option>
            )}
            {activeRestaurants.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="Title"
          hint="Auto-suggested from restaurant + delivery date until you edit it"
        >
          <input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setTitleTouched(true);
            }}
            disabled={!can.all}
            required
            className={inputClass}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Description (customer-facing blurb)">
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={!can.openFields}
              className={inputClass}
            />
          </Field>
        </div>
        <Field label="Delivery starts (IST)">
          <input
            type="datetime-local"
            value={deliveryStart}
            onChange={(e) => onDeliveryStartChange(e.target.value)}
            disabled={!can.all}
            required
            className={inputClass}
          />
        </Field>
        <Field label="Delivery ends (IST)">
          <input
            type="datetime-local"
            value={deliveryEnd}
            onChange={(e) => setDeliveryEnd(e.target.value)}
            disabled={!can.all}
            required
            className={inputClass}
          />
        </Field>
        <Field
          label="Order cutoff (IST)"
          hint="Default: delivery date − 1 day, 21:00. While open it can only move later."
        >
          <input
            type="datetime-local"
            value={cutoff}
            onChange={(e) => {
              setCutoff(e.target.value);
              setCutoffTouched(true);
            }}
            disabled={!can.openFields}
            required
            className={inputClass}
          />
        </Field>
        <Field label="Delivery fee (₹ per order)">
          <input
            type="number"
            min={0}
            step="0.01"
            value={deliveryFee}
            onChange={(e) => setDeliveryFee(e.target.value)}
            disabled={!can.all}
            className={inputClass}
          />
        </Field>
        <Field label="Min orders (go / no-go)">
          <input
            type="number"
            min={0}
            step={1}
            value={minOrders}
            onChange={(e) => setMinOrders(e.target.value)}
            disabled={!can.all}
            required
            className={inputClass}
          />
        </Field>
        <Field
          label="Max orders (hard cap)"
          hint={
            initial?.status === "open"
              ? `Not below current capacity used (${initial.counts.capacity_used})`
              : undefined
          }
        >
          <input
            type="number"
            min={1}
            step={1}
            value={maxOrders}
            onChange={(e) => setMaxOrders(e.target.value)}
            disabled={!can.openFields}
            required
            className={inputClass}
          />
        </Field>
        <Field
          label="Customer notes"
          hint='e.g. "Food arrives at your PG gate; we&apos;ll message the group"'
        >
          <textarea
            rows={2}
            value={customerNotes}
            onChange={(e) => setCustomerNotes(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Internal notes (admin only)">
          <textarea
            rows={2}
            value={internalNotes}
            onChange={(e) => setInternalNotes(e.target.value)}
            className={inputClass}
          />
        </Field>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Delivery points served</h2>
        {activePoints.length === 0 && (
          <p className="text-sm text-neutral-500">
            No active delivery points — add some first.
          </p>
        )}
        <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
          {activePoints.map((p) => (
            <label key={p.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={pointIds.includes(p.id)}
                disabled={!can.all}
                onChange={(e) =>
                  setPointIds((ids) =>
                    e.target.checked
                      ? [...ids, p.id]
                      : ids.filter((x) => x !== p.id),
                  )
                }
              />
              <span>
                {p.name}
                {p.area && (
                  <span className="text-neutral-500"> · {p.area}</span>
                )}
              </span>
            </label>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Items</h2>
          {can.all && (
            <button
              type="button"
              onClick={() => setItems((rows) => [...rows, emptyItem()])}
              className={secondaryButtonClass}
            >
              + Add item
            </button>
          )}
        </div>
        <div className="overflow-x-auto rounded-lg border border-neutral-200">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-2 py-2 text-left">Name / description</th>
                <th className="px-2 py-2 text-left">Price ₹</th>
                <th className="px-2 py-2 text-left">Cost ₹</th>
                <th className="px-2 py-2 text-center">Veg</th>
                <th className="px-2 py-2 text-left">Max / order</th>
                <th className="px-2 py-2 text-left">Max total</th>
                <th className="px-2 py-2 text-center">Avail.</th>
                <th className="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {items.map((row) => (
                <tr key={row.key} className="align-top">
                  <td className="min-w-56 px-2 py-2">
                    <input
                      placeholder="Item name"
                      value={row.name}
                      onChange={(e) =>
                        updateItem(row.key, { name: e.target.value })
                      }
                      disabled={!can.all}
                      required
                      className={`${inputClass} mb-1`}
                    />
                    <input
                      placeholder="Description (optional)"
                      value={row.description}
                      onChange={(e) =>
                        updateItem(row.key, { description: e.target.value })
                      }
                      disabled={!can.all}
                      className={inputClass}
                    />
                  </td>
                  <td className="w-24 px-2 py-2">
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={row.price}
                      onChange={(e) =>
                        updateItem(row.key, { price: e.target.value })
                      }
                      disabled={!can.all}
                      required
                      className={inputClass}
                    />
                  </td>
                  <td className="w-24 px-2 py-2">
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={row.cost}
                      onChange={(e) =>
                        updateItem(row.key, { cost: e.target.value })
                      }
                      disabled={!can.all}
                      className={inputClass}
                    />
                  </td>
                  <td className="px-2 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={row.is_veg}
                      onChange={(e) =>
                        updateItem(row.key, { is_veg: e.target.checked })
                      }
                      disabled={!can.all}
                    />
                  </td>
                  <td className="w-20 px-2 py-2">
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={row.max_qty_per_order}
                      onChange={(e) =>
                        updateItem(row.key, {
                          max_qty_per_order: e.target.value,
                        })
                      }
                      disabled={!can.all}
                      className={inputClass}
                    />
                  </td>
                  <td className="w-24 px-2 py-2">
                    <input
                      type="number"
                      min={0}
                      step={1}
                      placeholder="∞"
                      value={row.max_total_qty}
                      onChange={(e) =>
                        updateItem(row.key, { max_total_qty: e.target.value })
                      }
                      disabled={!can.openFields}
                      className={inputClass}
                    />
                  </td>
                  <td className="px-2 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={row.is_available}
                      onChange={(e) =>
                        updateItem(row.key, { is_available: e.target.checked })
                      }
                      disabled={!can.openFields}
                    />
                  </td>
                  <td className="px-2 py-2 text-right">
                    {can.all && (
                      <button
                        type="button"
                        onClick={() =>
                          setItems((rows) =>
                            rows.filter((r) => r.key !== row.key),
                          )
                        }
                        className="text-xs text-red-700 underline"
                      >
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-3 py-4 text-center text-neutral-500"
                  >
                    No items. A drop needs at least one item to be published.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {error && <ErrorBox message={error.message} details={error.details} />}

      <div className="flex gap-2">
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending
            ? "Saving…"
            : mode === "create"
              ? "Create draft"
              : "Save changes"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className={secondaryButtonClass}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
