import "server-only";
import { auth } from "@/auth";
import { apiFetch, ApiError } from "@/app/_libs/api/client";

// Calls the API as the signed-in admin. Every admin page and server action
// goes through here so the identity headers always come from the session.
export async function adminFetch<T>(
  path: string,
  init: Omit<RequestInit, "headers"> = {},
): Promise<T> {
  const session = await auth();
  const user = session?.user;
  if (!user?.isAdmin || !user.id || !user.email) {
    throw new ApiError(403, "FORBIDDEN", "Admin access required");
  }
  return apiFetch<T>(path, {
    ...init,
    session: { userId: user.id, email: user.email },
  });
}

/** Turn a thrown error into a form-friendly result. */
export type ActionResult =
  | { ok: true }
  | {
      ok: false;
      message: string;
      details?: { path: string; message: string }[];
    };

export function toActionError(err: unknown): ActionResult {
  if (err instanceof ApiError) {
    const details = Array.isArray(err.details)
      ? (err.details as { path: string; message: string }[])
      : undefined;
    return details
      ? { ok: false, message: err.message, details }
      : { ok: false, message: err.message };
  }
  return {
    ok: false,
    message: err instanceof Error ? err.message : "Something went wrong",
  };
}
