import type { DropStatus } from "@farbite/shared";

const STYLES: Record<DropStatus, string> = {
  draft: "bg-neutral-100 text-neutral-700",
  open: "bg-green-100 text-green-800",
  closed: "bg-amber-100 text-amber-800",
  confirmed: "bg-blue-100 text-blue-800",
  out_for_delivery: "bg-purple-100 text-purple-800",
  delivered: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-red-100 text-red-800",
};

export function StatusBadge({ status }: { status: DropStatus }) {
  return (
    <span
      className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${STYLES[status]}`}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}
