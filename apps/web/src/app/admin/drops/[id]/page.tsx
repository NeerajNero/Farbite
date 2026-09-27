import Link from "next/link";
import {
  DROP_FUNNEL_STEPS,
  formatPaise,
  toIST,
  type Drop,
  type DropDashboard,
} from "@farbite/shared";
import { adminFetch } from "@/app/_libs/api/admin";
import { StatusBadge } from "@/components/admin/status-badge";
import {
  PageHeader,
  secondaryButtonClass,
  tdClass,
  thClass,
} from "@/components/admin/ui";
import { DropActions } from "../_components/drop-actions";
import { DuplicateButton } from "../_components/duplicate-button";

export const dynamic = "force-dynamic";

const FUNNEL_LABELS: Record<(typeof DROP_FUNNEL_STEPS)[number], string> = {
  drop_viewed: "Views",
  checkout_started: "Checkouts",
  order_placed: "Placed",
  utr_submitted: "UTR submitted",
  payment_verified: "Verified",
};

const PHASE4_LINKS = [
  "Verify payments",
  "Restaurant sheet",
  "Packing list",
  "Refunds",
  "WhatsApp messages",
];

function Stat({
  label,
  value,
  tone = "",
}: {
  label: string;
  value: string | number;
  tone?: string;
}) {
  return (
    <div className="rounded-lg border border-neutral-200 px-4 py-3">
      <div className="text-xs uppercase tracking-wide text-neutral-500">
        {label}
      </div>
      <div className={`text-2xl font-semibold tabular-nums ${tone}`}>
        {value}
      </div>
    </div>
  );
}

export default async function DropDashboardPage({
  params,
}: PageProps<"/admin/drops/[id]">) {
  const { id } = await params;
  const [drop, dash] = await Promise.all([
    adminFetch<Drop>(`/v1/admin/drops/${id}`),
    adminFetch<DropDashboard>(`/v1/admin/drops/${id}/dashboard`),
  ]);
  const c = dash.counts;
  const pctOfMax =
    c.max_orders > 0
      ? Math.min(100, Math.round((c.paid / c.max_orders) * 100))
      : 0;
  const minMarker =
    c.max_orders > 0
      ? Math.min(100, Math.round((c.min_orders / c.max_orders) * 100))
      : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={drop.title}
        actions={
          <>
            <Link
              href={`/admin/drops/${drop.id}/edit`}
              className={secondaryButtonClass}
            >
              Edit
            </Link>
            <DuplicateButton dropId={drop.id} />
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-neutral-700">
        <StatusBadge status={drop.status} />
        <span>{drop.restaurant_name}</span>
        <span>
          Delivery {toIST(drop.delivery_starts_at)} –{" "}
          {toIST(drop.delivery_ends_at, {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          })}
        </span>
        <span>Cutoff {toIST(drop.cutoff_at)}</span>
        <span>Fee {formatPaise(drop.delivery_fee_paise)}</span>
        {drop.cancel_reason && (
          <span className="text-red-700">Cancelled: {drop.cancel_reason}</span>
        )}
      </div>

      <DropActions dropId={drop.id} status={drop.status} counts={c} />

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="Paid" value={c.paid} tone="text-green-800" />
        <Stat
          label="Awaiting verification"
          value={c.submitted}
          tone="text-amber-800"
        />
        <Stat label="Pending payment" value={c.pending} />
        <Stat
          label="Expired / rejected"
          value={c.expired_or_rejected}
          tone="text-neutral-500"
        />
        <Stat
          label="Capacity used"
          value={`${c.capacity_used} / ${c.max_orders}`}
        />
      </section>

      <section className="space-y-1">
        <div className="flex justify-between text-xs text-neutral-600">
          <span>
            Paid {c.paid} · min {c.min_orders} · max {c.max_orders}
          </span>
          <span>
            {c.paid >= c.min_orders
              ? "Minimum met ✓"
              : `${c.min_orders - c.paid} more to go ahead`}
          </span>
        </div>
        <div className="relative h-3 w-full overflow-hidden rounded bg-neutral-100">
          <div
            className="h-full bg-green-500"
            style={{ width: `${pctOfMax}%` }}
          />
          <div
            className="absolute top-0 h-full w-0.5 bg-neutral-800"
            style={{ left: `${minMarker}%` }}
            title="min orders"
          />
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <Stat label="Revenue (paid)" value={formatPaise(dash.revenue_paise)} />
        <div className="rounded-lg border border-neutral-200 px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-neutral-500">
            Estimated margin
          </div>
          {dash.estimated_margin_paise === null ? (
            <div className="text-sm text-neutral-500">
              Set cost prices on every item to see margin.
            </div>
          ) : (
            <div className="text-2xl font-semibold tabular-nums">
              {formatPaise(dash.estimated_margin_paise)}
            </div>
          )}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Funnel</h2>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {DROP_FUNNEL_STEPS.map((step, i) => (
            <span key={step} className="flex items-center gap-2">
              {i > 0 && <span className="text-neutral-400">→</span>}
              <span className="rounded border border-neutral-200 px-2 py-1">
                <span className="text-neutral-500">{FUNNEL_LABELS[step]}</span>{" "}
                <span className="font-semibold tabular-nums">
                  {dash.funnel[step] ?? 0}
                </span>
              </span>
            </span>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Items</h2>
        <div className="overflow-x-auto rounded-lg border border-neutral-200">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50">
              <tr>
                <th className={thClass}>Item</th>
                <th className={thClass}>Price</th>
                <th className={thClass}>Cost</th>
                <th className={thClass}>Sold</th>
                <th className={thClass}>Max / order</th>
                <th className={thClass}>Max total</th>
                <th className={thClass}>Available</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {drop.items.map((item) => (
                <tr
                  key={item.id}
                  className={item.is_available ? "" : "text-neutral-400"}
                >
                  <td className={tdClass}>
                    <span
                      className={`mr-1 inline-block h-2.5 w-2.5 rounded-sm border ${item.is_veg ? "border-green-700 bg-green-600" : "border-red-700 bg-red-600"}`}
                    />
                    {item.name}
                    {item.description && (
                      <div className="text-xs text-neutral-500">
                        {item.description}
                      </div>
                    )}
                  </td>
                  <td className={`${tdClass} tabular-nums`}>
                    {formatPaise(item.price_paise)}
                  </td>
                  <td className={`${tdClass} tabular-nums`}>
                    {item.cost_price_paise === null
                      ? "—"
                      : formatPaise(item.cost_price_paise)}
                  </td>
                  <td className={`${tdClass} tabular-nums`}>{item.sold_qty}</td>
                  <td className={`${tdClass} tabular-nums`}>
                    {item.max_qty_per_order}
                  </td>
                  <td className={`${tdClass} tabular-nums`}>
                    {item.max_total_qty ?? "∞"}
                  </td>
                  <td className={tdClass}>
                    {item.is_available ? "Yes" : "No"}
                  </td>
                </tr>
              ))}
              {drop.items.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-3 py-4 text-center text-neutral-500"
                  >
                    No items yet — add some before publishing.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Delivery points served</h2>
        {drop.delivery_points.length === 0 ? (
          <p className="text-sm text-neutral-500">
            None selected — pick at least one before publishing.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2 text-sm">
            {drop.delivery_points.map((p) => (
              <li
                key={p.id}
                className="rounded border border-neutral-200 px-2 py-1"
              >
                {p.name}
                {p.area && (
                  <span className="text-neutral-500"> · {p.area}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {(drop.customer_notes || drop.internal_notes) && (
        <section className="grid gap-3 sm:grid-cols-2 text-sm">
          {drop.customer_notes && (
            <div className="rounded-lg border border-neutral-200 p-3">
              <div className="text-xs uppercase tracking-wide text-neutral-500">
                Customer notes
              </div>
              <p className="whitespace-pre-wrap">{drop.customer_notes}</p>
            </div>
          )}
          {drop.internal_notes && (
            <div className="rounded-lg border border-neutral-200 p-3">
              <div className="text-xs uppercase tracking-wide text-neutral-500">
                Internal notes
              </div>
              <p className="whitespace-pre-wrap">{drop.internal_notes}</p>
            </div>
          )}
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Ops pages</h2>
        <div className="flex flex-wrap gap-2 text-sm">
          {PHASE4_LINKS.map((label) => (
            <span
              key={label}
              className="cursor-not-allowed rounded border border-dashed border-neutral-300 px-2 py-1 text-neutral-400"
              title="Arrives in Phase 4"
            >
              {label} (Phase 4)
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
