# Farbite

Scheduled batch pre-order service: one famous restaurant per weekend, pre-orders before a
cutoff, one bulk pickup, delivery to PG gates. Full spec: **`PLAN.md`** (single source of truth).

**Status:** Phase 1 of 7 complete (see PLAN.md §16) — monorepo scaffold, live DB schema on Neon,
idempotent seed, domain core with 51 unit tests. Next up: Phase 2 (Google sign-in + admin panel).

## Layout

```
apps/web/         Next.js 16 (App Router, TS, Tailwind) — customer site + admin panel. No DB access.
apps/api/         NestJS 12 — owns DB (Drizzle + Neon Postgres), business rules, jobs, payments.
packages/shared/  @farbite/shared — zod schemas, enums, money/date helpers used by both apps.
```

Browser talks only to Next.js; Next.js server calls the API with `X-Internal-Key` (BFF, PLAN §7.2).

## Local setup

Prereqs: Node ≥ 20, pnpm ≥ 10, a Neon Postgres database.

```bash
pnpm install
pnpm --filter @farbite/shared build        # shared package emits dist/ used by both apps

cp apps/api/.env.example apps/api/.env     # set DATABASE_URL, INTERNAL_API_KEY, ADMIN_EMAILS
cp apps/web/.env.example apps/web/.env.local
# apps/web INTERNAL_API_KEY must equal apps/api's; API_BASE_URL=http://localhost:3001

pnpm db:migrate                            # apply migrations to your DB
pnpm db:seed                               # placeholder data: 1 restaurant, 5 PGs, 1 draft drop (idempotent)

pnpm dev                                   # web on :3000, api on :3001
```

Open http://localhost:3000 — the status page shows API ● / Database ● / Internal key ●.

## Scripts (root)

| Script | What |
|---|---|
| `pnpm dev` | both apps in watch mode |
| `pnpm build` | shared → api → web |
| `pnpm test` | unit tests (51, Vitest — domain rules from PLAN §14) |
| `pnpm lint` | oxlint (api) + eslint (web) |
| `pnpm db:generate` | drizzle-kit: generate migration from `apps/api/src/db/schema.ts` |
| `pnpm db:migrate` | apply migrations |
| `pnpm db:seed` | idempotent placeholder seed (replace with real data before pilot) |

API-only: `pnpm --filter api test:e2e` (guards + health), `pnpm --filter api db:studio` (Drizzle Studio).

## What exists so far

- **DB (Neon)** — all 10 tables from PLAN §6 + 4 enums; unique order codes/tokens, global UTR
  anti-reuse, capacity-relevant indexes.
- **API** — `GET /health` (public), `GET /v1/ping` (guard smoke test); `InternalKeyGuard` →
  `ActorGuard` → `AdminGuard` chain; zod env validation; `{ error: { code, message } }` envelope.
- **Domain core** (`apps/api/src/domain/`) — drop/order state machines, capacity + cutoff checks,
  integer-paise totals, `FB-XXXX` order codes, phone/UTR validation. Pure TS, fully unit-tested.
- **Web** — BFF `apiFetch()` client (30 s timeout + "waking up" detection), mobile-first shell,
  Phase 0 status page at `/`.

## For agents

Read `CLAUDE.md` and `.claude/context/codebase-state.md` before any work. PLAN.md wins on conflicts.
Assumptions log: `DECISIONS.md`.
