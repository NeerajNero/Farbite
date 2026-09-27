"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { DropCounts, DropStatus } from "@farbite/shared";
import { transitionDrop } from "../_actions";
import { DROP_TRANSITIONS, TRANSITION_LABELS } from "../_libs/drop-transitions";
import {
  buttonClass,
  dangerButtonClass,
  inputClass,
  secondaryButtonClass,
} from "@/components/admin/ui";

type Props = { dropId: string; status: DropStatus; counts: DropCounts };

const CONFIRM_TEXT: Record<DropStatus, string> = {
  draft: "Move this drop back to draft?",
  open: "Publish this drop? Customers will be able to order until the cutoff.",
  closed: "Close ordering now? No new orders will be accepted.",
  confirmed:
    "Confirm the drop? Tell the restaurant first — this commits us to delivering.",
  cancelled:
    "Cancel this drop? Paid and submitted orders move to the refund queue.",
  out_for_delivery: "Mark as out for delivery?",
  delivered: "Mark the whole drop as delivered?",
};

export function DropActions({ dropId, status, counts }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [target, setTarget] = useState<DropStatus | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const options = DROP_TRANSITIONS[status];
  if (options.length === 0) return null;

  const needsOverride =
    target === "confirmed" && counts.paid < counts.min_orders;
  const reasonRequired = target === "cancelled" || needsOverride;

  function run() {
    if (!target) return;
    if (reasonRequired && reason.trim() === "") {
      setError("A reason is required.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const body = reason.trim()
        ? { to: target, reason: reason.trim() }
        : { to: target };
      const result = await transitionDrop(dropId, body);
      if (result.ok) {
        setTarget(null);
        setReason("");
        router.refresh();
      } else {
        setError(result.message);
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {options.map((to) => (
          <button
            key={to}
            type="button"
            disabled={pending}
            onClick={() => {
              setTarget(to);
              setReason("");
              setError(null);
            }}
            className={to === "cancelled" ? dangerButtonClass : buttonClass}
          >
            {TRANSITION_LABELS[to]}
          </button>
        ))}
      </div>

      {target && (
        <div className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm">
          <p className="font-medium">{CONFIRM_TEXT[target]}</p>
          {needsOverride && (
            <p className="text-amber-900">
              Paid orders ({counts.paid}) are below the minimum (
              {counts.min_orders}). Give a reason to override.
            </p>
          )}
          {(reasonRequired || target === "confirmed") && (
            <label className="block space-y-1">
              <span className="text-xs font-medium text-neutral-700">
                {target === "cancelled"
                  ? "Cancel reason (required)"
                  : needsOverride
                    ? "Override reason (required)"
                    : "Note (optional)"}
              </span>
              <textarea
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className={inputClass}
              />
            </label>
          )}
          {error && <p className="text-red-700">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={run}
              className={
                target === "cancelled" ? dangerButtonClass : buttonClass
              }
            >
              {pending
                ? "Working…"
                : `Yes, ${TRANSITION_LABELS[target].toLowerCase()}`}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setTarget(null)}
              className={secondaryButtonClass}
            >
              Back
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
