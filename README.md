# Farbite

Scheduled batch pre-order service: one famous restaurant per weekend, pre-orders before a
cutoff, one bulk pickup, delivery to PG gates. Full spec: **`PLAN.md`** (single source of truth).

## Layout

```
apps/web/         Next.js (App Router, TS, Tailwind) — customer site + admin panel. No DB access.
apps/api/         NestJS — owns DB, business rules, jobs, payment providers.
packages/shared/  zod schemas, enums, money/date helpers shared by both apps.
```

Browser talks only to Next.js; Next.js server calls the API with `X-Internal-Key` (BFF, PLAN §7.2).

## Local setup

Prereqs: Node ≥ 20, pnpm ≥ 10.

```bash
pnpm install
pnpm --filter @farbite/shared build   # shared package emits dist/ used by both apps

cp apps/api/.env.example apps/api/.env     # fill INTERNAL_API_KEY (any long random string)
cp apps/web/.env.example apps/web/.env.local
# apps/web INTERNAL_API_KEY must equal apps/api's; API_BASE_URL=http://localhost:3001

pnpm dev                                   # web on :3000, api on :3001
```

Open http://localhost:3000 — the Phase 0 status page shows API/DB/internal-key health.
`DATABASE_URL` (Neon) is optional until Phase 1; health shows "not configured" without it.

## Scripts (root)

| Script | What |
|---|---|
| `pnpm dev` | both apps in watch mode |
| `pnpm build` | shared → api → web |
| `pnpm test` | all tests (`apps/api`: Vitest; e2e via `pnpm --filter api test:e2e`) |
| `pnpm lint` | oxlint (api) + eslint (web) |
| `pnpm db:generate` / `db:migrate` / `db:seed` | arrive in Phase 1 |

## For agents

Read `CLAUDE.md` and `.claude/context/codebase-state.md` before any work. PLAN.md wins on conflicts.
