# Codebase State — Farbite

> **This is the single source of truth for the current state of the codebase.**
> Agents read THIS file instead of scanning the repository. Every agent that adds, fixes,
> or removes anything MUST update this file before its task is considered complete.
> Keep entries terse — this file is loaded as context; it must stay cheap to read.
> Product spec, data model, and business rules: `PLAN.md` (the plan wins on conflicts).

**Project status:** 🟢 Phase 1 complete (awaiting founder checkpoint). Next: Phase 2 — Auth.js + Google, admin CRUD for drops/restaurants/PGs. Phases: PLAN.md §16. Seed data is PLACEHOLDER (random restaurant/menu) — real data before pilot.

---

## Tech Stack

pnpm monorepo: `apps/api` (NestJS 11, TS strict, Drizzle + drizzle-kit, Neon Postgres) · `apps/web` (Next.js App Router, TS strict, Tailwind, Auth.js v5 Google, BFF — no DB) · `packages/shared` (zod DTOs, enums, formatPaise, toIST). No Redis/SQS/workers/SDK in v1 (see CLAUDE.md Project Overrides). Mobile: LATER.

## Architecture

```
Browser ──(same-origin, Auth.js cookie)──▶ Next.js server (apiClient() only)
         ──(X-Internal-Key + identity headers)──▶ NestJS /v1 ──▶ Neon Postgres
```

- API guards: `InternalKeyGuard` (global) → `ActorGuard` (builds req.actor) → `AdminGuard`
- Inside apps/api, the NestJS 4-layer pattern from `.claude/skills/backend/SKILL.md` applies
- Errors: `{ error: { code, message, details? } }` — codes in PLAN.md §10

---

## API Modules (apps/api/src/)

NestJS 12, ESM (`type: module`, relative imports need `.js` extension), Vitest, oxlint.

| Module | Path | Purpose | Status |
| ------ | ---- | ------- | ------ |
| App | `src/app.module.ts` | ConfigModule (zod `validateEnv`, `src/config/env.ts`), ScheduleModule, ThrottlerModule; global guards InternalKeyGuard→ActorGuard + AllExceptionsFilter | ✅ |
| Health | `src/health/` | `GET /health` (public), `DbHealthService` (pg pool, optional DATABASE_URL, 2 attempts) | ✅ |
| Ping | `src/ping/` | `GET /v1/ping` — Phase 0 smoke endpoint for guards (DECISIONS #3) | ✅ temp |
| Common | `src/common/` | `AppException(code)`, `AllExceptionsFilter` (§10 envelope), `InternalKeyGuard` (public: /health, /v1/webhooks/razorpay), `ActorGuard` (req.actor from X-Actor-* headers), `AdminGuard` (stub: ADMIN_EMAILS only), `ZodValidationPipe(schema)` per-route | ✅ |

Global prefix `v1` (exclude: `health`) set in `main.ts` — tests must call `app.setGlobalPrefix` too.

## DB Tables (live on Neon — migration 0000 applied)

All 10 §6 tables exist: `users, restaurants, delivery_points, drops, drop_items, drop_delivery_points, orders, order_items, payments, events` + 4 pg enums (values from `@farbite/shared`).

- Schema: `apps/api/src/db/schema.ts` · migrations: `src/db/migrations/` (drizzle-kit) · config: `drizzle.config.ts`
- Scripts (apps/api): `db:generate`, `db:migrate`, `db:studio`, `db:seed` (tsx, idempotent check-then-insert)
- Seeded (placeholder): 1 restaurant "Tandoor Junction (Test)", 5 PGs, 1 draft drop "…— Test Drop" w/ 6 items, admin user from ADMIN_EMAILS
- Notable constraints: orders.code/access_token/idempotency_key unique; payments.upi_ref unique (global UTR anti-reuse); order_items qty>0 check; cascades only drops→drop_items, orders→order_items

## Domain Core (apps/api/src/domain/ — pure TS, no HTTP/DB; 51 unit tests)

| File | Exports | Rules |
| ---- | ------- | ----- |
| `drop-state-machine.ts` | DROP_TRANSITIONS, canTransitionDrop, DROP_TRANSITION_TIMESTAMP, canConfirmDrop, orderStatusOnDropCancel | §5.1, §14.5–7 |
| `order-state-machine.ts` | ORDER_TRANSITIONS (incl. expired→payment_submitted revive), canTransitionOrder, isOrderActive/Expired/Confirmed, CAPACITY_HOLDING_STATUSES | §5.2, §14.2, §14.8 |
| `capacity.ts` | checkOrderPlacement → {ok}\|{ok:false,code} | §14.1, §0.8 |
| `compute-totals.ts` | computeTotals (integer paise, throws RangeError) | §14.4 |
| `order-code.ts` | generateOrderCode (`FB-` + 4, injectable rng), isValidOrderCode | §6 |
| `phone.ts` | normalisePhone (+91/91/0 → 10 digits) | §14.11 |
| `utr.ts` | validateUtr (12 digits) | §14.9 |

## Endpoints (/v1)

Target surface: PLAN.md §10.

| Method | Path | Guard | Notes |
| ------ | ---- | ----- | ----- |
| GET | `/health` | none (public) | `{ ok, db }` — db:false when DATABASE_URL unset |
| GET | `/v1/ping` | InternalKeyGuard | `{ pong, actor }` — Phase 0 smoke, remove/keep later |

## Scheduled Jobs

_None yet. Target: every minute — close drops past cutoff, expire pending orders (PLAN §7.4)._

## Shared Package (packages/shared — `@farbite/shared`)

CommonJS, tsc → `dist/`; build it before the apps (`pnpm build` handles order).

- `enums.ts` — DROP_STATUSES, ORDER_STATUSES, PAYMENT_PROVIDERS, PAYMENT_STATUSES, ERROR_CODES (+types)
- `money.ts` — `formatPaise`, `paiseToUpiAmount` (integer paise only, throws on non-integer)
- `dates.ts` — `toIST`
- `schemas/health.ts` — `healthResponseSchema` (zod DTOs grow here per feature)

---

## Web Pages / Routes (apps/web)

Next.js 16.3.5 (App Router, src dir, Tailwind v4). **Breaking changes vs training data** — read `apps/web/AGENTS.md` / `node_modules/next/dist/docs/` before nontrivial web work. Target: PLAN.md §8 + §9.

| Route | Area | Feature | Notes |
| ----- | ---- | ------- | ----- |
| `/` | public | Phase 0 status page (API/DB/key health via BFF) | becomes drop home in Phase 3 |

- `src/env.ts` — zod-validated server env (`serverEnv`), fails fast at boot
- `src/app/_libs/api/client.ts` — `apiFetch()` **the only** API caller: internal key + actor headers, 30 s timeout, `ApiError`, `isApiWakingUp()`; server-only
- `src/app/layout.tsx` — mobile-first shell (header with NEXT_PUBLIC_APP_NAME)

## Web Components

_None yet._

---

## Mobile — LATER

_Not started. Skills staged: `.claude/skills/react-native-expo/`, `.claude/skills/mobile-firebase/`._

---

## Known Gotchas

- `apps/api` is ESM + nodenext: relative imports need `.js` extensions; `ConfigModule.forRoot()` validates env at *import* time — e2e test env lives in `vitest.config.e2e.ts` `test.env`, and `ignoreEnvFile` is on when `NODE_ENV=test`.
- Next 16 differs from older Next docs — check `node_modules/next/dist/docs/` first (see `apps/web/AGENTS.md`).
- `create-next-app` drops a nested `pnpm-workspace.yaml` in the app — was deleted; don't reintroduce.

- PLAN.md overrides imported skill conventions: no `@food/sdk`, no SQL-first migrations (use drizzle-kit), no Redis/SQS. See CLAUDE.md "Project Overrides".
- Money: integer paise only. Never trust `drop.status` alone for "ordering open" — always also check `cutoff_at` + capacity (PLAN §14).
- Render free tier spins down (~1 min cold start): web fetches use 30 s timeout + "waking up" UI.
- Neon pooled connection: pg pool must tolerate dropped connections (low `idleTimeoutMillis`, one retry on `ECONNRESET`).

## Change Log (newest first)

- 2026-09-22 | Phase 1 | Drizzle schema for all §6 tables + enums; migration 0000 generated (drizzle-kit) and applied to Neon; idempotent placeholder seed (verified 2×); domain core (7 modules) + 51 unit tests for §14 rules; DATABASE_URL now required outside NODE_ENV=test; Google OAuth creds copied to apps/web/.env.local as AUTH_GOOGLE_ID/SECRET + AUTH_SECRET generated (Phase 2 ready). Health live-checks db:true.

- 2026-09-22 | rename | App renamed Weekend Drop → **Farbite**: root pkg `farbite`, shared pkg `@farbite/shared` (all imports updated), `NEXT_PUBLIC_APP_NAME`, README/CLAUDE/PLAN/DECISIONS; order-code prefix `WD-`→`FB-` in PLAN §4/§6; lockfile refreshed. Build + 5 e2e tests green after rename (DECISIONS #11).

- 2026-09-22 | Phase 0 | Scaffolded pnpm monorepo: `packages/shared` (@farbite/shared: enums, formatPaise/paiseToUpiAmount, toIST, health schema), `apps/api` (NestJS 12 ESM: env validation, InternalKeyGuard/ActorGuard/AdminGuard-stub, ZodValidationPipe, §10 error filter, /health, /v1/ping, Schedule+Throttler wired), `apps/web` (Next 16: serverEnv, apiFetch BFF client, layout, status page). Root scripts, README, DECISIONS.md, git init. Acceptance verified: both apps run, / shows health, wrong key → 401 (5 e2e tests green).

- 2026-09-22 | setup | Phase 0 started. PLAN.md reconciled with agent tooling (Context Protocol added as §0.14; skill-convention overrides noted in §7.1). CLAUDE.md + this file aligned to plan: apps/api (not apps/backend), packages/shared (no libs/sdk), drizzle-kit migrations, BFF/no SDK.
- 2026-09-22 | setup | Added Next.js web skills (11) + agents (7), mobile skills + firebase-integrator agent, and hooks (vendored-file guard, post-edit lint/type-check, prettier) in `.claude/settings.json`.
- 2026-09-22 | setup | Imported NestJS skills (21) and agents (12) from oku project into `.claude/`; created context system.
