"use server";

import { revalidatePath } from "next/cache";
import {
  createDeliveryPointBodySchema,
  updateDeliveryPointBodySchema,
  type DeliveryPoint,
} from "@farbite/shared";
import {
  adminFetch,
  toActionError,
  type ActionResult,
} from "@/app/_libs/api/admin";

const PATH = "/admin/delivery-points";

export async function createDeliveryPoint(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = createDeliveryPointBodySchema.safeParse(fromForm(formData));
  if (!parsed.success) return zodError(parsed.error);
  try {
    await adminFetch<DeliveryPoint>("/v1/admin/delivery-points", {
      method: "POST",
      body: JSON.stringify(parsed.data),
    });
    revalidatePath(PATH);
    return { ok: true };
  } catch (err) {
    return toActionError(err);
  }
}

export async function updateDeliveryPoint(
  id: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = updateDeliveryPointBodySchema.safeParse(fromForm(formData));
  if (!parsed.success) return zodError(parsed.error);
  return patch(id, parsed.data);
}

export async function setDeliveryPointActive(
  id: string,
  isActive: boolean,
): Promise<ActionResult> {
  return patch(id, { is_active: isActive });
}

async function patch(id: string, body: unknown): Promise<ActionResult> {
  try {
    await adminFetch<DeliveryPoint>(`/v1/admin/delivery-points/${id}`, {
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
  const sortRaw = formData.get("sort_order");
  const sortOrder =
    typeof sortRaw === "string" && sortRaw.trim() !== "" ? Number(sortRaw) : 0;
  return {
    name: formData.get("name") ?? "",
    area: text("area"),
    landmark: text("landmark"),
    handover_notes: text("handover_notes"),
    sort_order: Number.isInteger(sortOrder) ? sortOrder : 0,
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
