import type { DropStatus } from "@farbite/shared";

// Mirror of apps/api/src/domain/drop-state-machine.ts (PLAN.md §5.1). The API
// validates every transition; this only decides which buttons to show.
export const DROP_TRANSITIONS: Readonly<
  Record<DropStatus, readonly DropStatus[]>
> = {
  draft: ["open"],
  open: ["closed", "cancelled"],
  closed: ["confirmed", "cancelled"],
  confirmed: ["out_for_delivery"],
  out_for_delivery: ["delivered"],
  delivered: [],
  cancelled: [],
};

export const TRANSITION_LABELS: Readonly<Record<DropStatus, string>> = {
  draft: "Back to draft",
  open: "Publish",
  closed: "Close now",
  confirmed: "Confirm",
  cancelled: "Cancel drop",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
};

/** §9.1 editing rules — which fields the form may change per status. */
export type DropEditability = {
  all: boolean;
  openFields: boolean; // description, customer_notes, internal_notes, max_orders, cutoff_at, item availability/max_total
  notesOnly: boolean;
};

export function editabilityFor(
  status: DropStatus | undefined,
): DropEditability {
  if (!status || status === "draft")
    return { all: true, openFields: true, notesOnly: true };
  if (status === "open")
    return { all: false, openFields: true, notesOnly: true };
  return { all: false, openFields: false, notesOnly: true };
}
