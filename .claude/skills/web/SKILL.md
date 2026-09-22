---
name: web
description: Index of all web skills for the Next.js 16 web app (apps/web)
---

# Web Skills Index

Reference skills for code generation in `apps/web/src/` (paths below are relative to the app root).

## Two deliberate architecture choices

Two patterns in this app are intentional and must not be "simplified" away:

1. **URL-as-state for list pages** — filters in `useState` are lost on refresh; the URL survives refresh/back/share
2. **Server `page.tsx` + Suspense + client orchestrator split** — lets pages export `metadata` and satisfies Next 16's Suspense-around-`useSearchParams` build requirement (a client `page.tsx` forfeits both)

When extending this app and the skills are silent, follow the canonical list-page example listed in `.claude/context/codebase-state.md` (once the first list feature exists, it becomes the reference shape: `page.tsx` + `_components/<feature>-client.tsx` + `_libs/<feature>-search-params.ts`) and the existing composites before inventing a new shape.

## Skills

| Skill              | File                  | Agent                     | Purpose                                                                 |
| ------------------ | --------------------- | ------------------------- | ----------------------------------------------------------------------- |
| Page               | `page.md`             | `page-builder`            | App Router pages — thin server `page.tsx` + Suspense + client orchestrator |
| Component          | `component.md`        | `component-builder`       | ui primitives vs composites vs feature components; CVA variants; promotion rules |
| Data Table         | `data-table.md`       | `page-builder`            | The canonical list-page recipe — URL-state, filters, pagination, skeletons |
| Form               | `form.md`             | `component-builder`       | react-hook-form + zodResolver + shadcn Form primitives + mutation submit |
| API Hooks          | `api-hooks.md`        | `api-integration-builder` | @food/sdk + React Query hooks, query-key factories, mutations, admin-key proxying |
| Auth               | `auth.md`             | `api-integration-builder` | Middleware gating, session cookies, roles, backend admin-auth status    |
| Styling            | `styling.md`          | `component-builder`       | Tailwind v4 CSS-first tokens, theme variables, dark mode                |
| State Management   | `state-management.md` | `page-builder`            | URL-as-state, context, server/client boundary decisions                 |
| Test               | `test.md`             | `test-writer`             | Vitest unit/component tests, what to test, colocated `src/test/`        |
| Best Practices     | `web-best-practices.md` | `code-reviewer`       | Naming, imports, TypeScript strictness, security, anti-patterns         |

## Architecture

```
page.tsx (server: metadata + Suspense + skeleton)
  └─ <feature>-client.tsx (client orchestrator)
       ├─ URL search params  ←→  _libs/<feature>-search-params.ts (pure parse/build)
       ├─ React Query hooks  →  @/app/_libs/api/client.ts (@food/sdk clients)
       │                        @/app/_libs/api/query-keys.ts (key factories)
       └─ composites (DataTable, PageHeader, StatCard…) → ui primitives (shadcn)
```

| Layer | Location | Responsibility |
| ----- | -------- | -------------- |
| Route page | `src/app/(app)/<feature>/page.tsx` | Server component: metadata, Suspense, skeleton fallback |
| Client orchestrator | `.../_components/<feature>-client.tsx` | Data fetching (React Query), URL-state, layout of composites |
| Feature helpers | `.../_libs/` | Search-param parse/build, feature constants and types |
| Composites | `src/components/composites/` | Cross-feature building blocks (data-table + toolbar, page-header, stat-card, empty-state, user-info-cell, password-input, theme-toggle) |
| ui primitives | `src/components/ui/` | shadcn/ui generated — never hand-edited |
| API layer | `src/app/_libs/api/` | `apiFetch` wrapper (platform headers + typed `ApiError`) + SDK clients + query-key factories |
| Shell | `src/app/(app)/layout.tsx` | Grouped sidebar (`NAV_GROUPS`) + header with breadcrumbs (`_libs/breadcrumb-context.tsx`) |
| Providers | `src/app/providers/` | QueryProvider, AuthProvider |
| Edge gate | `src/proxy.ts` | Cookie-based auth redirects (Next 16 middleware) |

### Route groups

- `(auth)/` — unauthenticated (login). Centered card shell.
- `(app)/` — authenticated portal. Shell lives in `(app)/layout.tsx` (shadcn Sidebar + grouped `NAV_GROUPS` + breadcrumb header); every new feature route goes here and gets a `NAV_GROUPS` entry.

### The canonical example

No feature exists yet — the FIRST list page built becomes the canonical reference (record it in `.claude/context/codebase-state.md`). Every list feature follows the same shape: `page.tsx` + `_components/<feature>-client.tsx` + `_libs/<feature>-search-params.ts` + a test in `src/test/`.

### Data flow rules (non-negotiable)

1. All backend data via `@food/sdk` + React Query. No raw `fetch` in components, no server actions for backend data, no app-local database.
2. New backend domain ⇒ add the API class to `src/app/_libs/api/client.ts` and a key factory to `query-keys.ts`.
3. List/filter/pagination state lives in the URL via pure helpers; text search buffers locally through `useDebounce` before patching the URL.
4. Mutations invalidate `<DOMAIN>_KEYS.all` and toast via `sonner`.
5. Secrets never reach the client: `AdminApiKeyGuard`-protected backend endpoints are called only from server route handlers (see `api-hooks.md`).

### Current backend surface — DO NOT hardcode here

The live inventory of backend endpoints, auth status, and available SDK domains is maintained in
**`.claude/context/codebase-state.md`**. Read that file instead of scanning the backend.
Building web features that need new data usually means **backend work first** (new `src/api/<module>/`
endpoints) — coordinate with `.claude/skills/backend/` and regenerate `@food/sdk` (`pnpm sdk:generate`).

## Development Workflow

```
PRD → PLN-NNN (planning) → SPEC-NNN (spec) → Backend endpoints (if needed) → SDK regen → Web UI → Tests
```

Docs live in `docs/` (`planning/` + `specs/`, shared with backend — one SPEC numbering space). Backend-dependent features must list their backend SPEC as a dependency.

**Quality gates** (all must pass before a feature is complete):

```bash
pnpm type:check && pnpm lint && pnpm test:run
```

## Agents

| Agent                     | File                                             | Model  | Skills Served                       |
| ------------------------- | ------------------------------------------------ | ------ | ----------------------------------- |
| `page-builder`            | `.claude/agents/web/page-builder.md`           | Sonnet | page, data-table, state-management  |
| `component-builder`       | `.claude/agents/web/component-builder.md`      | Sonnet | component, form, styling            |
| `api-integration-builder` | `.claude/agents/web/api-integration-builder.md`| Sonnet | api-hooks, auth                     |
| `test-writer`             | `.claude/agents/web/test-writer.md`            | Sonnet | test                                |
| `code-reviewer`           | `.claude/agents/web/code-reviewer.md`          | Sonnet | web-best-practices (review)       |
| `debugger`                | `.claude/agents/web/debugger.md`               | Opus   | (diagnostic — hydration/SSR/routing/query bugs) |
| `spec-executor`           | `.claude/agents/web/spec-executor.md`          | Sonnet | (orchestrator — reads SPEC, delegates, runs quality gates) |
