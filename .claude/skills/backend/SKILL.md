---
name: backend
description: Index of all backend skills for the NestJS 11 API and Worker
---

# Backend Skills Index

Reference skills for code generation in `src/`.

## Skills

| Skill              | File                       | Agent                                   | Purpose                                                                  |
| ------------------ | -------------------------- | --------------------------------------- | ------------------------------------------------------------------------ |
| Module             | `module.md`                | `module-builder`                        | NestJS module scaffold with controller, service, repository, DTOs        |
| Controller         | `controller.md`            | `api-developer`                         | REST controllers with guards, decorators, Swagger annotations            |
| Service            | `service.md`               | `api-developer`                         | Feature service — business logic, injects DB module service (never repository) |
| Repository         | `repository.md`            | `module-builder`                        | Drizzle ORM repository — private to `src/db/<module>/`, used only by DB module service |
| **DB Module Service** | `db-service.md`         | `module-builder`                        | Data access wrapper in `src/db/<module>/` — only export consumed by feature services |
| DTO                | `dto.md`                   | `api-developer`                         | Request/response DTOs with class-validator and class-transformer         |
| Endpoint           | `endpoint.md`              | `api-developer`                         | Add new routes to existing controllers                                   |
| **Swagger**        | `swagger.md`               | `api-developer`                         | OpenAPI contract design — envelope, arrays, enums, SDK generation rules  |
| **Pagination**     | `pagination.md`            | `api-developer`                         | Paginated list endpoints — `{ items, pagination }` via `getPaginationDetails` + `PaginatedResponseDto` (`@common/pagination`) |
| **Error Handling** | `error-handling.md`        | `api-developer`                         | NestJS exception selection, PostgreSQL error code mapping, response shape |
| Migration          | `migration.md`             | `migration-builder`                     | SQL-first migrations — raw SQL, no Drizzle Kit codegen                   |
| Guard              | `guard.md`                 | `api-developer`                         | Auth guards, role guards, `@Throttle()` — read existing guards in `src/api/auth/guards/` first |
| Provider           | `provider.md`              | `provider-builder`                      | Strategy-pattern providers with abstract base + concrete implementations |
| **Background Job** | `background-job.md`        | `background-job-builder`                | Dispatch async jobs to existing SQS queues — email, notification, webhook |
| **SQS**            | `sqs.md`                   | `background-job-builder`                | Scaffold a new SQS queue end-to-end — producer, consumer, module, BackgroundModule wiring |
| **Cron**           | `cron.md`                  | `api-developer`                         | Add scheduled jobs to `CronScheduler` + `CronService`                    |
| **WebSocket**      | `websocket.md`             | `api-developer`                         | Emit Socket.IO events from services, handle inbound events in gateway    |
| TypeScript         | `typescript.md`            | `code-reviewer`                         | Strict-mode patterns, path aliases, import ordering, security rules      |
| Test               | `test.md`                  | `test-writer` / `integration-test-writer` | Unit tests (Jest), integration tests, e2e tests                        |
| Best Practices     | `backend-best-practices.md`| `code-reviewer`                         | Auth, cookies, API envelope, Swagger system, exception filter patterns   |

## Architecture

All backend code follows a 4-layer pattern:

```
Controller → Feature Service → DB Module Service → Repository → DBService (connection)
                             → Provider (external integrations)
```

Each layer has one responsibility:

| Layer | Location | Responsibility |
| ----- | -------- | -------------- |
| `DBService` | `src/db/db.service.ts` | Drizzle **connection** — provides `db` getter used by repositories |
| Repository | `src/db/<module>/<module>.repository.ts` | Drizzle queries only — **private** to `src/db/` |
| DB Module Service | `src/db/<module>/<module>.db-service.ts` | Wraps repository; **only entry point** for feature services |
| Feature Service | `src/api/<module>/<module>.service.ts` | Business logic — injects DB module service, never the repository |

> All modules live under `src/api/`, including auth (`src/api/auth/`, aliased as `@auth/*`).

### DB Module Structure (per domain)

```
src/db/<module>/
  <module>.repository.ts    # Drizzle queries — injects DBService; never imported outside src/db/
  <module>.db-service.ts    # Data access wrapper — injects repository; exported via DBModule
```

### API Module Structure (per domain)

```
src/api/<module>/
  <module>.module.ts
  <module>.controller.ts
  <module>.service.ts       # Feature service — injects DB module service from src/db/<module>/
  dto/
  interfaces/
```

Feature services import only the DB module service:

```ts
// src/api/profile/profile.service.ts
import { ProfileDbService } from '@db/profile/profile.db-service';

@Injectable()
export class ProfileService {
  constructor(private readonly profileDb: ProfileDbService) {}
}
```

### Existing Modules & DB Domains — DO NOT hardcode here

The live inventory of modules, DB domains, endpoints, and queues is maintained in
**`.claude/context/codebase-state.md`**. Read that file instead of scanning the codebase.
Every agent MUST update it after adding or changing anything (see Context Protocol in `CLAUDE.md`).

> All new feature modules go under `src/api/<module>/`.

### Module Registration — THREE places, not two

Every new versioned HTTP module must be registered in ALL of:

1. `src/app.module.ts` — enables routing (DI graph)
2. `src/db/db.module.ts` — repository (providers) + db-service (providers + exports), if the module has a DB layer
3. **`src/main.ts` `V1_MODULES`** — enables Swagger docs + SDK generation. **Most-missed step** (bit both the assistant and chat modules, 2026-07): routes work and tests pass without it, but the endpoints are silently invisible in `/api/v1` and absent from `@food/sdk`. Do NOT trust existing modules as templates for this — verify with:
   `grep -n "<Feature>Module" src/main.ts`

### Path Aliases

```
@common/*  @config/*  @db/*  @redis/*  @otel/*  @bg/*  @auth/*  @users/*
@media/*  @email/*  @sms/*  @notifications/*  @ai/*  @metrics/*  @health/*
@middlewares/*  @interceptors/*  @logger/*  @cron/*
@sqs/*  @email-queue/*  @notification-queue/*  @webhook-queue/*  @dead-letter-queue/*
```

### Database Workflow (SQL-First — CRITICAL)

Never use Drizzle Kit to generate migrations. Always write raw SQL.

```bash
pnpm db:create-migration <name>   # Create empty migration file + journal entry
# Edit src/db/drizzle/migrations/XXXX_<name>.sql
pnpm db:migrate                   # Apply migration
pnpm db:introspect                # Regenerate schema.ts
```

### Import Ordering

1. External packages (`@nestjs/*`, third-party)
2. Internal path aliases (`@common/*`, `@db/*`, `@auth/*`, etc.)
3. Relative imports (`./*`, `../`)

### Anti-Patterns to AVOID

- Business logic in controllers
- Placing new feature modules outside `src/api/` — every module goes in `src/api/<module>/`
- Registering a module in `app.module.ts` but not in `src/main.ts` `V1_MODULES` — routes work but are invisible to Swagger and the generated SDK (see Module Registration above)
- Importing repositories in feature services — always go through the DB module service (`src/db/<module>/<module>.db-service.ts`)
- Importing repositories outside `src/db/` — repositories are private to their `src/db/<module>/` folder
- Using `any` type — use `unknown` and narrow with type guards
- Hardcoding configuration — use `ConfigService`
- Circular dependencies between modules
- Skipping validation on endpoints
- Creating unnecessary files or premature abstractions
- Synchronous I/O operations
- `console.log` instead of `Logger`
- `configService.get('KEY')` without a fallback — returns `T | undefined`; always use `?? defaultValue`

## Development Workflow

```
PRD  →  PLN-NNN (planning docs)  →  SPEC-NNN (spec files)  →  Code Generation  →  Unit Tests  →  Manual Test
```

All workflow docs live in `docs/`:
- `prd/backend-prd.md` — source of truth
- `planning/` — `_PLN-TEMPLATE.md`; create `PLN-NNN-<feature>.md` from it per feature to track planning status
- `specs/SPEC-NNN-*.md` — one per feature, drives code generation (SPEC-001…013 exist, all `completed`)

**To execute a feature:** invoke `backend-spec-executor` with a SPEC ID.  
It runs pre-flight checks then code generation, and **always** ends with unit tests:

1. **Dependency check** — all `depends_on` specs must be `completed`
2. **Schema check** — all `required_tables` must exist in `schema.ts`
3. **Code generation** — module, controller, service, DTOs
4. **Unit tests** *(mandatory — never skipped)* — `*.spec.ts` co-located with every generated `*.service.ts`, `*.controller.ts`, `*.strategy.ts`
5. **type-check + lint** — must pass clean
6. Status updated to `completed` only after all of the above pass

A SPEC is **never** marked `completed` without passing unit tests.

## Agents

| Agent                   | File                                              | Model  | Skills Served                                        |
| ----------------------- | ------------------------------------------------- | ------ | ---------------------------------------------------- |
| `api-developer`         | `.claude/agents/backend/api-developer.md`         | Sonnet | controller, dto, endpoint, guard, swagger, pagination, error-handling, service, cron, websocket |
| `module-builder`        | `.claude/agents/backend/module-builder.md`        | Sonnet | module, repository, db-module-service                |
| `migration-builder`     | `.claude/agents/backend/migration-builder.md`     | Sonnet | migration                                            |
| `provider-builder`      | `.claude/agents/backend/provider-builder.md`      | Sonnet | provider                                             |
| `test-writer`           | `.claude/agents/backend/test-writer.md`           | Sonnet | test (unit — co-located `*.spec.ts`)                 |
| `integration-test-writer`| `.claude/agents/backend/integration-test-writer.md` | Sonnet | test (integration — `tests/integration/`, real DB/Redis; invoked by spec-executor after unit tests pass) |
| `code-reviewer`         | `.claude/agents/backend/code-reviewer.md`         | Sonnet | typescript, best-practices (review)                  |
| `background-job-builder`| `.claude/agents/backend/background-job-builder.md`| Sonnet | background-job, sqs — adds producers/consumers to existing or new queues |
| `client-sdk-generator`  | `.claude/agents/backend/backend-client-sdk-generator.md` | Sonnet | (regenerates `@food/sdk` at `libs/sdk` via `pnpm sdk:generate`) |
| `debugger`              | `.claude/agents/backend/debugger.md`              | Opus   | (diagnostic — no skill, invoked on errors)           |
| `pre-commit-reviewer`   | `.claude/agents/backend/pre-commit-reviewer.md`   | Sonnet | (pre-commit only — reads `git diff --staged`, checks architecture + SQS + security) |
| `spec-executor`         | `.claude/agents/backend/spec-executor.md`         | Sonnet | (orchestrator — reads SPEC file, runs pre-flight checks, delegates to agents, updates status) |
