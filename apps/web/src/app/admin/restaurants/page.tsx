import type { Restaurant } from "@farbite/shared";
import { adminFetch } from "@/app/_libs/api/admin";
import { PageHeader } from "@/components/admin/ui";
import { RestaurantsTable } from "./_components/restaurants-table";

export const dynamic = "force-dynamic";

export default async function RestaurantsPage() {
  const restaurants = await adminFetch<Restaurant[]>("/v1/admin/restaurants");
  return (
    <div className="space-y-4">
      <PageHeader title="Restaurants" />
      <RestaurantsTable restaurants={restaurants} />
    </div>
  );
}
