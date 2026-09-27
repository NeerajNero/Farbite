"use client";

import { useState, useTransition } from "react";
import type { Restaurant } from "@farbite/shared";
import {
  createRestaurant,
  setRestaurantActive,
  updateRestaurant,
} from "../_actions";
import { RestaurantForm } from "./restaurant-form";
import { secondaryButtonClass, tdClass, thClass } from "@/components/admin/ui";

export function RestaurantsTable({
  restaurants,
}: {
  restaurants: Restaurant[];
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggleActive(r: Restaurant) {
    setError(null);
    startTransition(async () => {
      const result = await setRestaurantActive(r.id, !r.is_active);
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
          <h2 className="mb-3 text-sm font-semibold">New restaurant</h2>
          <RestaurantForm
            action={createRestaurant}
            onDone={() => setAdding(false)}
            submitLabel="Add restaurant"
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className={secondaryButtonClass}
        >
          + Add restaurant
        </button>
      )}

      <div className="overflow-x-auto rounded-lg border border-neutral-200">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50">
            <tr>
              <th className={thClass}>Name</th>
              <th className={thClass}>Area</th>
              <th className={thClass}>Phone</th>
              <th className={thClass}>Active</th>
              <th className={thClass}></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {restaurants.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-3 py-6 text-center text-neutral-500"
                >
                  No restaurants yet.
                </td>
              </tr>
            )}
            {restaurants.map((r) =>
              editingId === r.id ? (
                <tr key={r.id}>
                  <td colSpan={5} className="bg-neutral-50 px-3 py-3">
                    <RestaurantForm
                      action={updateRestaurant.bind(null, r.id)}
                      initial={r}
                      onDone={() => setEditingId(null)}
                      submitLabel="Save"
                    />
                  </td>
                </tr>
              ) : (
                <tr
                  key={r.id}
                  className={r.is_active ? "" : "text-neutral-400"}
                >
                  <td className={tdClass}>
                    <div className="font-medium">{r.name}</div>
                    {r.address && (
                      <div className="text-xs text-neutral-500">
                        {r.address}
                      </div>
                    )}
                  </td>
                  <td className={tdClass}>{r.area ?? "—"}</td>
                  <td className={tdClass}>{r.phone ?? "—"}</td>
                  <td className={tdClass}>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => toggleActive(r)}
                      className={`rounded px-2 py-0.5 text-xs font-medium ${
                        r.is_active
                          ? "bg-green-100 text-green-800"
                          : "bg-neutral-100 text-neutral-600"
                      }`}
                    >
                      {r.is_active ? "Active" : "Inactive"}
                    </button>
                  </td>
                  <td className={`${tdClass} text-right`}>
                    <button
                      type="button"
                      onClick={() => setEditingId(r.id)}
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
