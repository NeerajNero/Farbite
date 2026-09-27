import Link from "next/link";
import { toIST, type DropListItem } from "@farbite/shared";
import { adminFetch } from "@/app/_libs/api/admin";
import { StatusBadge } from "@/components/admin/status-badge";
import {
  buttonClass,
  PageHeader,
  tdClass,
  thClass,
} from "@/components/admin/ui";
import { DuplicateButton } from "./_components/duplicate-button";

export const dynamic = "force-dynamic";

const TIME_ONLY: Intl.DateTimeFormatOptions = {
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
};

export default async function DropsPage() {
  const drops = await adminFetch<DropListItem[]>("/v1/admin/drops");

  return (
    <div className="space-y-4">
      <PageHeader
        title="Drops"
        actions={
          <Link href="/admin/drops/new" className={buttonClass}>
            + New drop
          </Link>
        }
      />
      <div className="overflow-x-auto rounded-lg border border-neutral-200">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50">
            <tr>
              <th className={thClass}>Drop</th>
              <th className={thClass}>Status</th>
              <th className={thClass}>Delivery (IST)</th>
              <th className={thClass}>Cutoff (IST)</th>
              <th className={thClass}>Paid / Submitted / Pending</th>
              <th className={thClass}>Min / Max</th>
              <th className={thClass}></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {drops.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-3 py-6 text-center text-neutral-500"
                >
                  No drops yet. Create the first one.
                </td>
              </tr>
            )}
            {drops.map((d) => (
              <tr key={d.id}>
                <td className={tdClass}>
                  <Link
                    href={`/admin/drops/${d.id}`}
                    className="font-medium text-blue-700 hover:underline"
                  >
                    {d.title}
                  </Link>
                  <div className="text-xs text-neutral-500">
                    {d.restaurant_name}
                  </div>
                </td>
                <td className={tdClass}>
                  <StatusBadge status={d.status} />
                </td>
                <td className={`${tdClass} whitespace-nowrap`}>
                  {toIST(d.delivery_starts_at)} –{" "}
                  {toIST(d.delivery_ends_at, TIME_ONLY)}
                </td>
                <td className={`${tdClass} whitespace-nowrap`}>
                  {toIST(d.cutoff_at)}
                </td>
                <td className={`${tdClass} whitespace-nowrap tabular-nums`}>
                  <span className="font-medium text-green-800">
                    {d.counts.paid}
                  </span>{" "}
                  / <span className="text-amber-800">{d.counts.submitted}</span>{" "}
                  / <span className="text-neutral-600">{d.counts.pending}</span>
                </td>
                <td className={`${tdClass} whitespace-nowrap tabular-nums`}>
                  {d.min_orders} / {d.max_orders}
                </td>
                <td className={`${tdClass} whitespace-nowrap text-right`}>
                  <DuplicateButton
                    dropId={d.id}
                    className="text-blue-700 underline"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
