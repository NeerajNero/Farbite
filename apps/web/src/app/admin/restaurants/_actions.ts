"use server";

import { revalidatePath } from "next/cache";
import {
  createRestaurantBodySchema,
  updateRestaurantBodySchema,
  type Restaurant,
} from "@farbite/shared";
import {
  adminFetch,
  toActionError,
  type ActionResult,
} from "@/app/_libs/api/admin";

const PATH = "/admin/restaurants";

export async function createRestaurant(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = createRestaurantBodySchema.safeParse(fromForm(formData));
  if (!parsed.success) return zodError(parsed.error);
  try {
    await adminFetch<Restaurant>("/v1/admin/restaurants", {
      method: "POST",
      body: JSON.stringify(parsed.data),
    });
    revalidatePath(PATH);
    return { ok: true };
  } catch (err) {
    return toActionError(err);
  }
}

export async function updateRestaurant(
  id: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = updateRestaurantBodySchema.safeParse(fromForm(formData));
  if (!parsed.success) return zodError(parsed.error);
  return patch(id, parsed.data);
}

export async function setRestaurantActive(
  id: string,
  isActive: boolean,
): Promise<ActionResult> {
  return patch(id, { is_active: isActive });
}

async function patch(id: string, body: unknown): Promise<ActionResult> {
  try {
    await adminFetch<Restaurant>(`/v1/admin/restaurants/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    revalidatePath(PATH);
    return { ok: true };
  } catch (err) {
    return toActionError(err);
  }
}

function fromForm(formData: FormData) {
  const text = (k: string) => {
    const v = formData.get(k);
    return typeof v === "string" && v.trim() !== "" ? v : null;
  };
  return {
    name: formData.get("name") ?? "",
    area: text("area"),
    address: text("address"),
    phone: text("phone"),
    notes: text("notes"),
  };
}

function zodError(err: {
  issues: { path: PropertyKey[]; message: string }[];
}): ActionResult {
  return {
    ok: false,
    message: "Please fix the highlighted fields",
    details: err.issues.map((i) => ({
      path: i.path.map(String).join("."),
      message: i.message,
    })),
  };
}
