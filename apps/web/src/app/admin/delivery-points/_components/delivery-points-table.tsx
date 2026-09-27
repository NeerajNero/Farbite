"use client";

import { useState, useTransition } from "react";
import type { DeliveryPoint } from "@farbite/shared";
import {
  createDeliveryPoint,
  setDeliveryPointActive,
  updateDeliveryPoint,
} from "../_actions";
import { DeliveryPointForm } from "./delivery-point-form";
import { secondaryButtonClass, tdClass, thClass } from "@/components/admin/ui";

export function DeliveryPointsTable({ points }: { points: DeliveryPoint[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggleActive(p: DeliveryPoint) {
    setError(null);
    startTransition(async () => {
      const result = await setDeliveryPointActive(p.id, !p.is_active);
      if (!result.ok) setError(result.message);
    });
  }

  return (
    <div className="space-y-4">
      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {adding ? (
        <div className="rounded-lg border border-neutral-200 p-4">
          <h2 className="mb-3 text-sm font-semibold">New delivery point</h2>
          <DeliveryPointForm
            action={createDeliveryPoint}
            onDone={() => setAdding(false)}
            submitLabel="Add delivery point"
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className={secondaryButtonClass}
        >
          + Add delivery point
        </button>
      )}

      <div className="overflow-x-auto rounded-lg border border-neutral-200">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50">
            <tr>
              <th className={thClass}>#</th>
              <th className={thClass}>Name</th>
              <th className={thClass}>Area</th>
              <th className={thClass}>Landmark</th>
              <th className={thClass}>Active</th>
              <th className={thClass}></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {points.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-3 py-6 text-center text-neutral-500"
                >
                  No delivery points yet.
                </td>
              </tr>
            )}
            {points.map((p) =>
              editingId === p.id ? (
                <tr key={p.id}>
                  <td colSpan={6} className="bg-neutral-50 px-3 py-3">
                    <DeliveryPointForm
                      action={updateDeliveryPoint.bind(null, p.id)}
                      initial={p}
                      onDone={() => setEditingId(null)}
                      submitLabel="Save"
                    />
                  </td>
                </tr>
              ) : (
                <tr
                  key={p.id}
                  className={p.is_active ? "" : "text-neutral-400"}
                >
                  <td className={tdClass}>{p.sort_order}</td>
                  <td className={tdClass}>
                    <div className="font-medium">{p.name}</div>
                    {p.handover_notes && (
                      <div className="text-xs text-neutral-500">
                        {p.handover_notes}
                      </div>
                    )}
                  </td>
                  <td className={tdClass}>{p.area ?? "—"}</td>
                  <td className={tdClass}>{p.landmark ?? "—"}</td>
                  <td className={tdClass}>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => toggleActive(p)}
                      className={`rounded px-2 py-0.5 text-xs font-medium ${
                        p.is_active
                          ? "bg-green-100 text-green-800"
                          : "bg-neutral-100 text-neutral-600"
                      }`}
                    >
                      {p.is_active ? "Active" : "Inactive"}
                    </button>
                  </td>
                  <td className={`${tdClass} text-right`}>
                    <button
                      type="button"
                      onClick={() => setEditingId(p.id)}
                      className="text-blue-700 underline"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
