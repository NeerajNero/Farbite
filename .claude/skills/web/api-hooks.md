# Skill: API Hooks (@food/sdk + React Query)

How ALL backend data flows through the admin app. No raw `fetch`, no server actions, no local DB.

## The stack

```
@food/sdk (libs/sdk — generated typescript-fetch client)
  → src/app/_libs/api/client.ts      (one Configuration + instantiated per-domain clients)
  → src/app/_libs/api/query-keys.ts  (key factories)
  → useQuery/useMutation in feature client components
```

## client.ts + api-error.ts (apiFetch wrapper)

`src/app/_libs/api/client.ts` builds a single `Configuration` with a custom `fetchApi` wrapper that:

- tags every request with `x-platform: admin` / `x-app-context: food-admin`
- sends `credentials: "include"` (httpOnly-cookie auth)
- throws a typed **`ApiError`** (`api-error.ts`) for every failure — network errors get friendly copy, 429s get the throttle message, backend envelope fields (`statusCode`, `message`, `error`, `data`) are preserved

`ApiError` is registered as React Query's default error type (module augmentation), so `error` in every `useQuery`/`useMutation` is an `ApiError` — use `error.statusCode` / `error.message` directly, no `instanceof Error` dance:

```tsx
const { error } = useQuery({ ... });
if (error) toast.error(error.message);         // already user-friendly
mutation.onError = (error) => {
  if (error.statusCode === 409) { /* conflict-specific handling */ }
};
```

It also exports instantiated clients:

```ts
export const api = {
  auth: new AuthApi(configuration),
  users: new UsersApi(configuration),
  subscription: new SubscriptionApi(configuration),
  // add new domains here
} as const;
```

Components import `api` — never `new SomeApi()` inline. When a new backend domain appears in the SDK, add it here + a key factory.

## Query keys

One factory per domain in `query-keys.ts`:

```ts
export const FEATURE_KEYS = {
  all: ["feature"] as const,
  list: (params: Record<string, unknown>) => [...FEATURE_KEYS.all, "list", params] as const,
  detail: (id: string) => [...FEATURE_KEYS.all, "detail", id] as const,
};
```

Never inline query-key arrays in components — invalidation depends on factories.

## Queries and mutations

```tsx
const { data, isLoading, error } = useQuery({
  queryKey: FEATURE_KEYS.detail(id),
  queryFn: () => api.users.<method>({ id }),
});

const mutation = useMutation({
  mutationFn: (dto: UpdateDto) => api.users.<updateMethod>({ id, dto }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: FEATURE_KEYS.all });
    toast.success("Updated");
  },
});
```

- Response envelope: the backend wraps payloads (`{ statusCode, message, data }` transform interceptor) — the generated SDK types reflect this; drill into `.data` per the generated model types
- Lists use `placeholderData: (previous) => previous` (see `data-table.md`)
- Query defaults are set in `src/app/providers/query-provider.tsx` (staleTime 60s, retry 1) — don't override per-hook without a reason

## SDK regeneration

The SDK is generated from the backend OpenAPI spec:

```bash
# backend must be running on :3000
pnpm sdk:generate   # from repo root
```

New backend endpoints only appear if their module is registered in `src/main.ts` `V1_MODULES` (most-missed backend step). If a method you expect is missing from `@food/sdk`, check that first.

## Admin-key-guarded endpoints (server-only proxy)

`GET /v1/admin/subscriptions/metrics` (and future `AdminApiKeyGuard` endpoints) require the `X-Admin-Api-Key` header. That key is a server secret — **it must never appear in client code or `NEXT_PUBLIC_*` vars**. Call such endpoints from a route handler:

```ts
// src/app/api/admin-metrics/route.ts (server-only)
export async function GET() {
  const response = await fetch(`${env.NEXT_PUBLIC_BACKEND_URL}/v1/admin/subscriptions/metrics`, {
    headers: { "X-Admin-Api-Key": process.env.ADMIN_API_KEY ?? "" },
    cache: "no-store",
  });
  return Response.json(await response.json(), { status: response.status });
}
```

then `useQuery` against `/api/admin-metrics`. Add `ADMIN_API_KEY` to the `server` block of `env.ts` when first used. This is the ONE sanctioned use of a route handler for data.

## Anti-patterns

- `fetch`/`axios` directly in components
- `useEffect` + `setState` data fetching
- Inline query keys
- Instantiating SDK Api classes outside `client.ts`
- Server actions for backend data
- Putting `ADMIN_API_KEY` anywhere client-reachable
