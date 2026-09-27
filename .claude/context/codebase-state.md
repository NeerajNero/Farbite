# Codebase State — Farbite

> **This is the single source of truth for the current state of the codebase.**
> Agents read THIS file instead of scanning the repository. Every agent that adds, fixes,
> or removes anything MUST update this file before its task is considered complete.
> Keep entries terse — this file is loaded as context; it must stay cheap to read.
> Product spec, data model, and business rules: `PLAN.md` (the plan wins on conflicts).

**Project status:** 🟢 Phase 2 complete (awaiting founder checkpoint: sign in with Google, create/publish/close/cancel a drop, non-admin → 403). Next: Phase 3 — customer browse/order/pay (manual UPI), scheduled job. Phases: PLAN.md §16. Seed data is PLACEHOLDER (random restaurant/menu) — real data before pilot.

---

## Tech Stack

pnpm monorepo: `apps/api` (NestJS 11, TS strict, Drizzle + drizzle-kit, Neon Postgres) · `apps/web` (Next.js App Router, TS strict, Tailwind, Auth.js v5 Google, BFF — no DB) · `packages/shared` (zod DTOs, enums, formatPaise, toIST). No Redis/SQS/workers/SDK in v1 (see CLAUDE.md Project Overrides). Mobile: LATER.

## Architecture

```
Browser ──(same-origin, Auth.js cookie)──▶ Next.js server (apiClient() only)
         ──(X-Internal-Key + identity headers)──▶ NestJS /v1 ──▶ Neon Postgres
```

- API guards: `InternalKeyGuard` (global) → `ActorGuard` (builds req.actor) → `AdminGuard` (`@UseGuards` on admin controllers: email ∈ ADMIN_EMAILS **and** users.is_admin via DB)
- Web auth: Auth.js v5 Google, JWT strategy, no adapter. `jwt` callback → `POST /v1/users/upsert` → `userId`/`isAdmin` in the token. `src/proxy.ts` gates `/admin/**` (no session → `/auth/signin`, non-admin → real 403). `adminFetch()` (`src/app/_libs/api/admin.ts`) is the only way admin pages/actions call the API.
- Inside apps/api, the NestJS 4-layer pattern from `.claude/skills/backend/SKILL.md` applies
- Errors: `{ error: { code, message, details? } }` — codes in PLAN.md §10

---

## API Modules (apps/api/src/)

NestJS 12, ESM (`type: module`, relative imports need `.js` extension), Vitest, oxlint.

| Module | Path | Purpose | Status |
| ------ | ---- | ------- | ------ |
| App | `src/app.module.ts` | ConfigModule (zod `validateEnv`, `src/config/env.ts`), ScheduleModule, ThrottlerModule; global guards InternalKeyGuard→ActorGuard + AllExceptionsFilter; imports Db, Events, Health, Users, Admin | ✅ |
| Db | `src/db/` | `DbModule` (@Global) → `DbService`: one pg pool + Drizzle (`db`, `run(fn)` retries once on ECONNRESET/57P01, `ping()`, `isConfigured`); types `Db`, `Tx`, `DbOrTx` | ✅ |
| Events | `src/events/` | `EventsModule` (@Global) → `EventsRepository.log({type, dropId?, orderId?, actor, meta?}, tx?)` append-only §6/§13 | ✅ |
| Health | `src/health/` | `GET /health` (public) via `DbService.ping()` | ✅ |
| Ping | `src/ping/` | `GET /v1/ping` — Phase 0 smoke endpoint (status page `/` still uses it; DECISIONS #3) | ✅ temp |
| Users | `src/users/` | `POST /v1/users/upsert` (sign-in upsert, is_admin recomputed from ADMIN_EMAILS); `UsersService.isAdmin(id,email)` used by AdminGuard | ✅ |
| Admin | `src/admin/` | `AdminModule`: restaurants, delivery-points, drops, settings — each controller `@UseGuards(AdminGuard)`; layers controller → service → repository (Drizzle, accepts `DbOrTx`) → DbService | ✅ |
| Admin/Drops | `src/admin/drops/` | `drop-edit-rules.ts` (pure §9.1 rules `validateDropPatch`, `canPublishDrop`, 12 tests), `drops.repository.ts` (counts via `count(*) filter`, sold_qty, revenue/cost, funnel, cascade cancel), `drops.service.ts` (create/update/duplicate/transition/dashboard; transitions lock the drop row `FOR UPDATE`) | ✅ |
| Common | `src/common/` | `AppException(code)`, `AllExceptionsFilter` (§10 envelope), `InternalKeyGuard` (public: /health, /v1/webhooks/razorpay), `ActorGuard`, `AdminGuard`, `ZodValidationPipe(schema)` per-route, `actorLabel()` for events.actor | ✅ |

Global prefix `v1` (exclude: `health`) set in `main.ts` — tests must call `app.setGlobalPrefix` too.

## DB Tables (live on Neon — migration 0000 applied)

All 10 §6 tables exist: `users, restaurants, delivery_points, drops, drop_items, drop_delivery_points, orders, order_items, payments, events` + 4 pg enums (values from `@farbite/shared`).

- Schema: `apps/api/src/db/schema.ts` · migrations: `src/db/migrations/` (drizzle-kit) · config: `drizzle.config.ts`
- Scripts (apps/api): `db:generate`, `db:migrate`, `db:studio`, `db:seed` (tsx, idempotent check-then-insert)
- Seeded (placeholder): 1 restaurant "Tandoor Junction (Test)", 5 PGs, 1 draft drop "…— Test Drop" w/ 6 items, admin user from ADMIN_EMAILS
- Notable constraints: orders.code/access_token/idempotency_key unique; payments.upi_ref unique (global UTR anti-reuse); order_items qty>0 check; cascades only drops→drop_items, orders→order_items

## Domain Core (apps/api/src/domain/ — pure TS, no HTTP/DB; 51 unit tests + 12 in admin/drops)

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
| POST | `/v1/users/upsert` | internal key | `UpsertUserBody` → `{ id, is_admin }`; called by Auth.js `jwt` callback |
| GET/POST | `/v1/admin/restaurants`, PATCH `/:id` | AdminGuard | `Restaurant` DTOs; PATCH accepts `is_active` |
| GET/POST | `/v1/admin/delivery-points`, PATCH `/:id` | AdminGuard | `DeliveryPoint` DTOs; ordered by sort_order, name |
| GET/POST | `/v1/admin/drops`, GET/PATCH `/:id` | AdminGuard | list → `DropListItem[]` (with `counts`); `Drop` has items (+`sold_qty`) and delivery_points. PATCH: `items` array is the full set (rows w/o id = new; missing = deleted in draft, rejected when open); §9.1 rules → 400 VALIDATION_ERROR |
| POST | `/v1/admin/drops/:id/duplicate` | AdminGuard | new draft, title + " (copy)", dates shifted +7d·n into the future |
| POST | `/v1/admin/drops/:id/transition` | AdminGuard | `{ to, reason? }`; §5.1 edges else 409 INVALID_TRANSITION; open: needs items+PGs+future cutoff+no other open drop (§14.13); confirmed: paid ≥ min or reason (§14.6, logs `drop_confirmed`); cancelled: reason required, cascades orders (§14.7), logs `drop_cancelled` |
| GET | `/v1/admin/drops/:id/dashboard` | AdminGuard | `counts`, `revenue_paise` (paid+delivered), `estimated_margin_paise` (null if any cost missing), `funnel` from events |
| GET | `/v1/admin/settings` | AdminGuard | non-secret env display (§9.10) |

Not yet: public drop/order routes (Phase 3), admin ops routes §9.3–9.8 (Phase 4), `/me` (Phase 5).

## Scheduled Jobs

_None yet. Target: every minute — close drops past cutoff, expire pending orders (PLAN §7.4)._

## Shared Package (packages/shared — `@farbite/shared`)

CommonJS, tsc → `dist/`; build it before the apps (`pnpm build` handles order).

- `enums.ts` — DROP_STATUSES, ORDER_STATUSES, PAYMENT_PROVIDERS, PAYMENT_STATUSES, ERROR_CODES (+types)
- `money.ts` — `formatPaise`, `paiseToUpiAmount` (integer paise only, throws on non-integer)
- `dates.ts` — `toIST`, `istLocalToIso` / `isoToIstLocal` (datetime-local inputs in IST ⇄ UTC ISO)
- `schemas/common.ts` — `uuidSchema`, `isoDateTimeSchema`, `paiseSchema`, `optionalTextSchema`
- `schemas/health.ts`, `users.ts` (upsert), `restaurants.ts`, `delivery-points.ts`, `drops.ts` (item/counts/drop/list/create/update/transition/dashboard + `DROP_FUNNEL_STEPS`), `settings.ts` — wire format is snake_case JSON, ISO UTC timestamps, integer paise; API maps Drizzle camelCase rows → DTOs in each service

---

## Web Pages / Routes (apps/web)

Next.js 16.3.5 (App Router, src dir, Tailwind v4). **Breaking changes vs training data** — read `apps/web/AGENTS.md` / `node_modules/next/dist/docs/` before nontrivial web work. Target: PLAN.md §8 + §9.

| Route | Area | Feature | Notes |
| ----- | ---- | ------- | ----- |
| `/` | public | Phase 0 status page (API/DB/key health via BFF) | becomes drop home in Phase 3; wraps itself in the narrow container (root layout is now full-width) |
| `/api/auth/*` | auth | Auth.js handlers | `src/app/api/auth/[...nextauth]/route.ts` |
| `/auth/signin`, `/auth/error` | auth | Google sign-in card (server action `signInWithGoogle`, same-site `callbackUrl` only), error page | `src/app/_libs/auth/actions.ts` also has `signOutAction` |
| `/admin` | admin | redirects to `/admin/drops`; `layout.tsx` re-checks session (403 UI) + nav + sign-out | gated by `src/proxy.ts` |
| `/admin/drops` | admin | §9.1 list: status badge, restaurant, delivery window (IST), paid/submitted/pending, min/max, Duplicate | `_actions.ts`: create/update/duplicate/transition |
| `/admin/drops/new`, `/admin/drops/[id]/edit` | admin | `DropForm` (client): title auto-suggest, IST datetime-local, cutoff default −1d 21:00, ₹→paise, PG checkboxes, inline item rows; fields disabled per status (`_libs/drop-transitions.ts` `editabilityFor`) | on `open` sends full item rows with ids |
| `/admin/drops/[id]` | admin | §9.2 dashboard: big numbers, progress vs min/max, revenue/margin, funnel, items, PGs; `DropActions` (inline confirm panel; cancel reason; override reason when paid < min); Phase-4 links greyed | |
| `/admin/restaurants`, `/admin/delivery-points` | admin | §9.9 table + add form + inline edit + active toggle (`useActionState`) | |
| `/admin/settings` | admin | §9.10 read-only env display | |

- `src/env.ts` — zod-validated server env (`serverEnv`), fails fast at boot
- `src/app/_libs/api/client.ts` — `apiFetch()` **the only** header builder: internal key + actor headers, 30 s timeout, `ApiError`, `isApiWakingUp()`; server-only
- `src/app/_libs/api/admin.ts` — `adminFetch()` (session → actor headers, 403 if not admin), `ActionResult`, `toActionError()` for server actions
- `src/auth.config.ts` (edge-safe) / `src/auth.ts` (full, with upsert) / `src/types/next-auth.d.ts` / `src/proxy.ts` (matcher `/admin/:path*`)
- `src/app/layout.tsx` — shell: header `max-w-5xl`, full-width `main` (pages pick their own container)

## Web Components

- `src/components/admin/ui.tsx` — input/button class strings, `Field`, `ErrorBox`, `PageHeader` (plain Tailwind, no shadcn)
- `src/components/admin/status-badge.tsx`, `sign-out-button.tsx`
- Feature-local: `src/app/admin/drops/_components/{drop-form,drop-actions,duplicate-button}.tsx`, `src/app/admin/{restaurants,delivery-points}/_components/*`

---

## Mobile — LATER

_Not started. Skills staged: `.claude/skills/react-native-expo/`, `.claude/skills/mobile-firebase/`._

---

## Known Gotchas

- Web `tsc --noEmit` needs `.next/types` (run `pnpm exec next typegen` or a build first) — `PageProps<'/admin/drops/[id]'>` route types are generated.
- Drop PATCH `items` is the **full** set: sending a partial array on an open drop → "Cannot remove items"; the web form always sends every row with its id.
- Admin actor must exist in `users` with `is_admin=true` (AdminGuard checks the DB) — an email added to ADMIN_EMAILS only becomes admin after its next Google sign-in (upsert recomputes) or `pnpm db:seed` (promotes the first ADMIN_EMAILS entry).
- Seed drop's cutoff is relative to when the seed ran — publish fails with "Cutoff is already in the past" once it's stale; edit the dates first.

- `apps/api` is ESM + nodenext: relative imports need `.js` extensions; `ConfigModule.forRoot()` validates env at *import* time — e2e test env lives in `vitest.config.e2e.ts` `test.env`, and `ignoreEnvFile` is on when `NODE_ENV=test`.
- Next 16 differs from older Next docs — check `node_modules/next/dist/docs/` first (see `apps/web/AGENTS.md`).
- `create-next-app` drops a nested `pnpm-workspace.yaml` in the app — was deleted; don't reintroduce.

- PLAN.md overrides imported skill conventions: no `@food/sdk`, no SQL-first migrations (use drizzle-kit), no Redis/SQS. See CLAUDE.md "Project Overrides".
- Money: integer paise only. Never trust `drop.status` alone for "ordering open" — always also check `cutoff_at` + capacity (PLAN §14).
- Render free tier spins down (~1 min cold start): web fetches use 30 s timeout + "waking up" UI.
- Neon pooled connection: pg pool must tolerate dropped connections (low `idleTimeoutMillis`, one retry on `ECONNRESET`).

## Change Log (newest first)

- 2026-09-27 | Phase 2 | Shared DTOs (users/restaurants/delivery-points/drops/settings + IST helpers). API: `DbModule`/`DbService` (single pool, retry), `EventsRepository`, `POST /users/upsert`, `AdminGuard` now checks users.is_admin, `AdminModule` (restaurants, delivery-points, drops CRUD/duplicate/transition/dashboard, settings); §9.1 edit rules pure + 12 tests; §14.7 cancel cascade wired into transition. Web: Auth.js v5 Google (JWT, upsert in `jwt` callback), `proxy.ts` admin gate (307 → signin, 403 non-admin), `adminFetch`, auth pages, admin shell + drops list/form/dashboard/actions, restaurants + delivery points CRUD, settings. Verified: 63 api unit + 5 e2e tests green; live curl of every admin route incl. one-open rule, override confirm, cancel; web tsc/lint/build green; `/admin` → 307 signin. Google sign-in itself needs the founder's account (checkpoint).

- 2026-09-22 | Phase 1 | Drizzle schema for all §6 tables + enums; migration 0000 generated (drizzle-kit) and applied to Neon; idempotent placeholder seed (verified 2×); domain core (7 modules) + 51 unit tests for §14 rules; DATABASE_URL now required outside NODE_ENV=test; Google OAuth creds copied to apps/web/.env.local as AUTH_GOOGLE_ID/SECRET + AUTH_SECRET generated (Phase 2 ready). Health live-checks db:true.

- 2026-09-22 | rename | App renamed Weekend Drop → **Farbite**: root pkg `farbite`, shared pkg `@farbite/shared` (all imports updated), `NEXT_PUBLIC_APP_NAME`, README/CLAUDE/PLAN/DECISIONS; order-code prefix `WD-`→`FB-` in PLAN §4/§6; lockfile refreshed. Build + 5 e2e tests green after rename (DECISIONS #11).

- 2026-09-22 | Phase 0 | Scaffolded pnpm monorepo: `packages/shared` (@farbite/shared: enums, formatPaise/paiseToUpiAmount, toIST, health schema), `apps/api` (NestJS 12 ESM: env validation, InternalKeyGuard/ActorGuard/AdminGuard-stub, ZodValidationPipe, §10 error filter, /health, /v1/ping, Schedule+Throttler wired), `apps/web` (Next 16: serverEnv, apiFetch BFF client, layout, status page). Root scripts, README, DECISIONS.md, git init. Acceptance verified: both apps run, / shows health, wrong key → 401 (5 e2e tests green).

- 2026-09-22 | setup | Phase 0 started. PLAN.md reconciled with agent tooling (Context Protocol added as §0.14; skill-convention overrides noted in §7.1). CLAUDE.md + this file aligned to plan: apps/api (not apps/backend), packages/shared (no libs/sdk), drizzle-kit migrations, BFF/no SDK.
- 2026-09-22 | setup | Added Next.js web skills (11) + agents (7), mobile skills + firebase-integrator agent, and hooks (vendored-file guard, post-edit lint/type-check, prettier) in `.claude/settings.json`.
- 2026-09-22 | setup | Imported NestJS skills (21) and agents (12) from oku project into `.claude/`; created context system.
