import Link from "next/link";
import type { DeliveryPoint, Drop, Restaurant } from "@farbite/shared";
import { adminFetch } from "@/app/_libs/api/admin";
import { StatusBadge } from "@/components/admin/status-badge";
import { PageHeader } from "@/components/admin/ui";
import { DropForm } from "../../_components/drop-form";

export const dynamic = "force-dynamic";

export default async function EditDropPage({
  params,
}: PageProps<"/admin/drops/[id]/edit">) {
  const { id } = await params;
  const [drop, restaurants, deliveryPoints] = await Promise.all([
    adminFetch<Drop>(`/v1/admin/drops/${id}`),
    adminFetch<Restaurant[]>("/v1/admin/restaurants"),
    adminFetch<DeliveryPoint[]>("/v1/admin/delivery-points"),
  ]);
  return (
    <div className="space-y-4">
      <PageHeader
        title={`Edit: ${drop.title}`}
        actions={
          <Link
            href={`/admin/drops/${drop.id}`}
            className="text-sm text-blue-700 underline"
          >
            ← Dashboard
          </Link>
        }
      />
      <p className="text-sm text-neutral-600">
        Status: <StatusBadge status={drop.status} />{" "}
        {drop.status === "open" && (
          <span>
            — while open you can change notes, max orders (not below current),
            cutoff (later only), item availability and item max totals.
          </span>
        )}
        {drop.status !== "draft" && drop.status !== "open" && (
          <span>— only notes are editable now.</span>
        )}
      </p>
      <DropForm
        mode="edit"
        initial={drop}
        restaurants={restaurants}
        deliveryPoints={deliveryPoints}
      />
    </div>
  );
}
