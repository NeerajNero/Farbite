"use server";

import { revalidatePath } from "next/cache";
import {
  createDropBodySchema,
  transitionDropBodySchema,
  updateDropBodySchema,
  type Drop,
} from "@farbite/shared";
import {
  adminFetch,
  toActionError,
  type ActionResult,
} from "@/app/_libs/api/admin";

export type DropActionResult = ActionResult | { ok: true; id: string };

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

function revalidateDrop(id?: string) {
  revalidatePath("/admin/drops");
  if (id) {
    revalidatePath(`/admin/drops/${id}`);
    revalidatePath(`/admin/drops/${id}/edit`);
  }
}

export async function createDrop(body: unknown): Promise<DropActionResult> {
  const parsed = createDropBodySchema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);
  try {
    const drop = await adminFetch<Drop>("/v1/admin/drops", {
      method: "POST",
      body: JSON.stringify(parsed.data),
    });
    revalidateDrop(drop.id);
    return { ok: true, id: drop.id };
  } catch (err) {
    return toActionError(err);
  }
}

export async function updateDrop(
  id: string,
  body: unknown,
): Promise<DropActionResult> {
  const parsed = updateDropBodySchema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);
  try {
    const drop = await adminFetch<Drop>(`/v1/admin/drops/${id}`, {
      method: "PATCH",
      body: JSON.stringify(parsed.data),
    });
    revalidateDrop(drop.id);
    return { ok: true, id: drop.id };
  } catch (err) {
    return toActionError(err);
  }
}

export async function duplicateDrop(id: string): Promise<DropActionResult> {
  try {
    const drop = await adminFetch<Drop>(`/v1/admin/drops/${id}/duplicate`, {
      method: "POST",
    });
    revalidateDrop(drop.id);
    return { ok: true, id: drop.id };
  } catch (err) {
    return toActionError(err);
  }
}

export async function transitionDrop(
  id: string,
  body: unknown,
): Promise<DropActionResult> {
  const parsed = transitionDropBodySchema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);
  try {
    const drop = await adminFetch<Drop>(`/v1/admin/drops/${id}/transition`, {
      method: "POST",
      body: JSON.stringify(parsed.data),
    });
    revalidateDrop(drop.id);
    return { ok: true, id: drop.id };
  } catch (err) {
    return toActionError(err);
  }
}
