import type { DeliveryPoint } from "@farbite/shared";
import { adminFetch } from "@/app/_libs/api/admin";
import { PageHeader } from "@/components/admin/ui";
import { DeliveryPointsTable } from "./_components/delivery-points-table";

export const dynamic = "force-dynamic";

export default async function DeliveryPointsPage() {
  const points = await adminFetch<DeliveryPoint[]>("/v1/admin/delivery-points");
  return (
    <div className="space-y-4">
      <PageHeader title="Delivery points (PGs)" />
      <DeliveryPointsTable points={points} />
    </div>
  );
}
