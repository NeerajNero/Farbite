# CLAUDE.md — Farbite

> **`PLAN.md` is the single source of truth for v1** — product spec, data model, business rules (§14), phases.
> Backend patterns live in `.claude/skills/backend/SKILL.md`; web patterns in `.claude/skills/web/SKILL.md`.
> The **live state of the codebase** lives in `.claude/context/codebase-state.md`.
> Precedence when files conflict: PLAN.md > codebase-state.md (current facts) > SKILL.md (patterns) > this file.

## Repo Layout (pnpm monorepo — PLAN.md §7.1)

```
apps/web/         Next.js (App Router, TS strict, Tailwind). Customer site + admin panel. No DB access.
                  → skills: .claude/skills/web/      agents: .claude/agents/web/
apps/api/         NestJS 11 (TS strict). Owns DB, business rules, jobs, payment providers.
                  → skills: .claude/skills/backend/  agents: .claude/agents/backend/
packages/shared/  zod schemas (request/response DTOs), enums, money + date helpers. Imported by both apps.
PLAN.md           product plan — read before any feature work
DECISIONS.md      assumptions made by the agent
```

Paths inside skill files are relative to the owning app's root (e.g. `src/api/` means `apps/api/src/api/`).

## Context Protocol (applies to Claude AND all subagents)

1. **Start of any task:** read `.claude/context/codebase-state.md` first. It lists every module,
   table, endpoint, page, and job that exists. Do NOT scan the whole repository to discover
   state — only open source files for the specific module being touched.
2. **End of any task that added/fixed/changed/removed something:** update
   `.claude/context/codebase-state.md`:
   - update the relevant inventory table (Modules / Tables / Endpoints / Pages / Jobs)
   - append a line to **Change Log** (newest first): `- YYYY-MM-DD | <who> | <what changed>`
   - record any newly discovered pitfall under **Known Gotchas**
3. A task is **not complete** until the context file reflects the change. Review agents must flag
   diffs that change `apps/` or `packages/` without updating the context file.
4. Keep the context file terse. Inventory tables + one-line log entries. No prose dumps.

## Agentic Flow

- Work **one PLAN.md phase at a time** (§16); report and stop at each checkpoint.
- Delegate to the specialized agents in `.claude/agents/` (`backend-api-developer`,
  `web-page-builder`, etc.) for scoped build tasks; the Context Protocol applies to them too.
- **Hooks** (`.claude/settings.json` + `.claude/hooks/`): a PreToolUse guard asks before editing
  vendored/generated files; a PostToolUse hook runs prettier + lint + type-check on edited web
  TS/TSX files.

## Project Overrides (PLAN.md wins over imported skill conventions)

- **No generated SDK in v1.** Browser → Next.js BFF (`apiClient()` helper) → NestJS with
  `X-Internal-Key` + identity headers (PLAN §7.2). Ignore `@food/sdk` / `sdk:generate` references
  in skills; `web/api-hooks.md` and `backend-client-sdk-generator` are pattern reference only.
- **Migrations via `drizzle-kit generate`** (PLAN §2), not hand-written SQL — the
  `backend/migration.md` skill's SQL-first rule does not apply here.
- **No Redis, no SQS, no workers in v1.** Scheduled jobs via `@nestjs/schedule` inside the API.
- **Money is integer paise, always.** Timestamps `timestamptz` UTC in DB, display `Asia/Kolkata`.

## Tech Stack

- **API** (`apps/api`): NestJS 11, TypeScript strict, Drizzle ORM + drizzle-kit, PostgreSQL (Neon pooled), `@nestjs/config` + `@nestjs/schedule` + `@nestjs/throttler`, zod validation via `packages/shared`
- **Web** (`apps/web`): Next.js (App Router), TypeScript strict, Tailwind, Auth.js v5 (Google), BFF pattern — no DB access
- **Shared** (`packages/shared`): zod DTOs, enums, `formatPaise`, `toIST`

## Commands (root)

```bash
pnpm dev            # both apps (web :3000, api :3001)
pnpm build          # build all
pnpm test           # tests
pnpm lint           # lint all
pnpm db:generate    # drizzle-kit generate (from schema)
pnpm db:migrate     # apply migrations
pnpm db:seed        # seed data
```

## TypeScript Strictness

- `exactOptionalPropertyTypes` — omit optional keys instead of assigning `undefined`
- `noUncheckedIndexedAccess` — index access returns `T | undefined`; check before use
- Config access always has a fallback or throws at boot (both apps validate env with zod and fail fast)
- No `any` — use `unknown` + type guards; prefix unused params with `_`
- No `number` arithmetic on rupees — integer paise only (`formatPaise` for display)
