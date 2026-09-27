import type { DeliveryPoint, Restaurant } from "@farbite/shared";
import { adminFetch } from "@/app/_libs/api/admin";
import { PageHeader } from "@/components/admin/ui";
import { DropForm } from "../_components/drop-form";

export const dynamic = "force-dynamic";

export default async function NewDropPage() {
  const [restaurants, deliveryPoints] = await Promise.all([
    adminFetch<Restaurant[]>("/v1/admin/restaurants"),
    adminFetch<DeliveryPoint[]>("/v1/admin/delivery-points"),
  ]);
  return (
    <div className="space-y-4">
      <PageHeader title="New drop" />
      <DropForm
        mode="create"
        restaurants={restaurants}
        deliveryPoints={deliveryPoints}
      />
    </div>
  );
}
