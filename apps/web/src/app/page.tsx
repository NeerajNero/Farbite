import type { HealthResponse } from "@farbite/shared";
import { apiFetch, ApiError, isApiWakingUp } from "@/app/_libs/api/client";

// Phase 0: proves the BFF path (browser → Next.js server → NestJS) end-to-end.
// Replaced by the real drop home page in Phase 3 (PLAN.md §8.1).

export const dynamic = "force-dynamic";

type ApiStatus =
  | { state: "ok"; health: HealthResponse; guard: "ok" | "unauthorized" }
  | { state: "waking" }
  | { state: "error"; message: string };

async function checkApi(): Promise<ApiStatus> {
  try {
    const health = await apiFetch<HealthResponse>("/health");
    let guard: "ok" | "unauthorized" = "ok";
    try {
      await apiFetch<{ pong: true }>("/v1/ping");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) guard = "unauthorized";
      else throw err;
    }
    return { state: "ok", health, guard };
  } catch (err) {
    if (isApiWakingUp(err)) return { state: "waking" };
    return { state: "error", message: err instanceof Error ? err.message : "Unknown error" };
  }
}

function StatusRow({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-neutral-200 px-4 py-3">
      <span className="text-sm font-medium">{label}</span>
      <span className={`text-sm ${ok ? "text-green-700" : "text-red-600"}`}>
        {ok ? "●" : "○"} {detail}
      </span>
    </div>
  );
}

export default async function Home() {
  const status = await checkApi();

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">System status (Phase 0)</h1>

      {status.state === "waking" && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          The API is waking up… refresh in a few seconds.
        </p>
      )}

      {status.state === "error" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          API unreachable: {status.message}
        </p>
      )}

      {status.state === "ok" && (
        <div className="space-y-2">
          <StatusRow label="API" ok={status.health.ok} detail={status.health.ok ? "up" : "down"} />
          <StatusRow
            label="Database"
            ok={status.health.db}
            detail={status.health.db ? "connected" : "not configured"}
          />
          <StatusRow
            label="Internal key"
            ok={status.guard === "ok"}
            detail={status.guard === "ok" ? "accepted" : "rejected (401)"}
          />
        </div>
      )}

      <p className="text-xs text-neutral-500">
        This page will become the drop home in Phase 3.
      </p>
    </div>
  );
}
