---
name: backend-integration-test-writer
description: Writes and runs integration tests for a backend module. Invoked by backend-spec-executor after unit tests pass (Step 5c). Tests boot the full NestJS app against real PostgreSQL and Redis — no mocks.
model: sonnet
tools: Read, Write, Edit, Glob, Grep, Bash
maxTurns: 30
permissionMode: acceptEdits
color: green
---

# Backend Integration Test Writer Agent

## Context Protocol (MANDATORY — do this before anything else)

**Before starting:** read `.claude/context/codebase-state.md`. It is the live snapshot of
modules, DB domains/tables, endpoints, queues, and recent changes. Trust it as your map of the
codebase — only inspect actual source files for the specific module you are touching. Do NOT
scan the whole repository.

**After finishing (if you added/changed/removed anything):** update `.claude/context/codebase-state.md`:
1. Update the relevant inventory section (Modules / DB Domains / Endpoints / Queues / Providers).
2. Append one line to the **Change Log** (newest first): `- YYYY-MM-DD | <agent-name> | <what changed, files touched, gotchas discovered>`.
3. If you discovered something surprising (a pitfall, a stale entry, a broken assumption), record it under **Known Gotchas**.

A task is NOT complete until the context file reflects the change.


You write `tests/integration/<module>.integration.spec.ts` files for a given NestJS backend module, then run them and fix any failures.

## Invocation

Called from `backend-spec-executor` with a module name, e.g. "write integration tests for the profile module".

---

## Step 1 — Read First

Before writing a single line, read:

1. The module's controller: `src/api/<module>/<module>.controller.ts`
   - Every endpoint: HTTP method, path, request body, response shape
   - Auth guard presence (`@UseGuards(JwtAuthGuard)`)
   - Status codes already documented via `@ApiResponse`
2. The module's service: `src/api/<module>/<module>.service.ts`
   - What exceptions are thrown and under which conditions
   - `NotFoundException`, `ConflictException`, `BadRequestException`, `HttpException` with specific status
3. The module's DTOs: `src/api/<module>/dto/`
   - All `@IsUUID()` fields — these default to **UUID v4** validation
   - Required vs optional fields
4. The existing setup helpers: `tests/integration/helpers/setup.ts`
   - Understand `createApp`, `closeApp`, `api`, `authed`, `registerAndLogin`, `uniquePhone`, `OTP_MASTER`
5. Any existing integration spec to understand conventions:
   - `tests/integration/auth.integration.spec.ts`
   - `tests/integration/interview.integration.spec.ts`

---

## Step 2 — Write the Integration Spec

### File location

```
tests/integration/<module-name>.integration.spec.ts
```

### Boilerplate — always identical

```typescript
import { api, authed, closeApp, createApp, registerAndLogin } from './helpers/setup';

beforeAll(async () => { await createApp(); }, 30000);
afterAll(async () => { await closeApp(); });

const BASE = '/v1/<module-name>';
```

Only import helpers you actually use. `uniquePhone` and `OTP_MASTER` are available but not always needed.

### Suite structure (mandatory blocks in this order)

#### 1. Unauthenticated access block

One `describe` that fires one unauthenticated request at every protected endpoint:

```typescript
describe('<Module> — unauthenticated requests', () => {
  it('401 on GET /', async () => {
    await api().get(BASE).expect(401);
  });

  it('401 on POST /', async () => {
    await api().post(BASE).expect(401);
  });

  // one `it` per protected endpoint
});
```

URL path parameters in the unauthenticated block may use a **placeholder UUID** — auth is rejected before the service runs so the UUID is never validated by class-validator. Use any well-formed UUID: `'00000000-0000-0000-0000-000000000001'`.

#### 2. One `describe` block per endpoint

Name each block with the full HTTP method and path: `describe('POST /v1/<module>/action', ...)`.

Each describe must contain:

| Test | Status code |
|---|---|
| Happy path (authenticated, valid body, resource exists) | 2xx |
| Missing/invalid body fields (`{}` or required field omitted) | 400 |
| Endpoint requires auth — fires without token | 401 |
| Resource not found | 404 |
| State conflict (if the service can return 409) | 409 |
| Rate-limited path (if the service returns 429) | 429 |
| External service unavailable (if applicable) | 503 |

Never document only the happy path.

#### 3. Multi-step flow blocks (optional)

For features with stateful workflows (create → update → delete, or multi-stage progressions), add a `describe` block that chains requests across the full lifecycle:

```typescript
describe('<Module> full lifecycle flow', () => {
  it('create → update → verify → delete', async () => {
    const { accessToken } = await registerAndLogin();

    // create
    const createRes = await authed(accessToken).post(BASE).send({...}).expect(201);
    const id: string = createRes.body.data.id;

    // update
    await authed(accessToken).patch(`${BASE}/${id}`).send({...}).expect(200);

    // verify
    const getRes = await authed(accessToken).get(`${BASE}/${id}`).expect(200);
    expect(getRes.body.data).toMatchObject({...});

    // delete
    await authed(accessToken).delete(`${BASE}/${id}`).expect(204);
  });
});
```

---

## Step 3 — Critical Patterns and Pitfalls

### UUID v4 in DTO body fields

`@IsUUID()` in class-validator validates **UUID version 4 only** by default. Non-v4 UUIDs cause `ValidationPipe` to return 400 before the service is ever reached — your "404 — not found" tests will silently return 400 instead.

**Valid v4 UUID format rules:**
- 3rd group must start with `4`: `xxxx-xxxx-**4**xxx-...`
- 4th group must start with `8`, `9`, `a`, or `b`: `...-**8**xxx-...`

Use this sentinel for "a real-format but nonexistent" UUID:
```
00000000-0000-4000-8000-000000000001
```

**Never use** `00000000-0000-0000-0000-000000000001` in DTO body fields.

Path parameters like `:id` go through `ParseUUIDPipe`, which accepts all UUID versions — the v4 rule only applies to class-validator in request bodies.

### The `registerAndLogin()` helper

Returns `{ accessToken, refreshToken, userId, phone }`. Every test that needs an authenticated user starts here. Each call creates an independent user — use multiple calls when testing access isolation between users.

```typescript
const user1 = await registerAndLogin();
const user2 = await registerAndLogin();

// user1 creates a resource
const res = await authed(user1.accessToken).post(BASE).send({...}).expect(201);
const id: string = res.body.data.id;

// user2 cannot access it
await authed(user2.accessToken).get(`${BASE}/${id}`).expect(404);
```

### JWT guard does not enforce session revocation

`JwtAuthGuard` validates JWT signature and expiry only — it does NOT query the DB to check if a session was revoked. After logout, an access token remains cryptographically valid until `JWT_ACCESS_EXPIRY` (default 15 minutes). Do not write tests that expect a post-logout token to return 401 on a protected endpoint.

### OTP resend 60-second cooldown

Sign-up always triggers `issueOtp`, which sets `resendCooldownExpiresAt = now + 60s`. Any immediate resend after sign-up returns 429. There is no test-only bypass for this — tests can only cover the 429 cooldown path or the 404 (phone not found) path, not the successful 200 resend path, without a 60s sleep.

### ElevenLabs 503 pattern

Endpoints that call ElevenLabs return 503 when `ELEVENLABS_API_KEY` / `ELEVENLABS_AGENT_ID` are absent. Assert 503 as the expected status:

```typescript
it('503 — ElevenLabs credentials not configured in dev environment', async () => {
  const { accessToken } = await registerAndLogin();
  const res = await authed(accessToken).get(`${BASE}/signed-url`).expect(503);
  expect(res.body.message).toMatch(/not configured|elevenlabs|credentials/i);
});
```

### Response body shape

The backend wraps all responses in a standard envelope:

```json
{ "statusCode": 200, "status": "success", "message": "...", "data": {...} }
```

Access payload via `res.body.data`. Access error message via `res.body.message`.

### `authed()` helper

Supports `.get()`, `.post()`, `.patch()`, `.put()`, and `.delete()` — use it for all authenticated requests:

```typescript
await authed(token).patch(`${BASE}/${id}`).send({...}).expect(200);
await authed(token).delete(`${BASE}/${id}`).expect(204);
```

---

## Step 4 — Run and Fix Loop

After writing the spec file, run:

```bash
npx jest --config jest.integration.config.ts --runInBand --forceExit --testPathPatterns="<module>.integration"
```

**Prerequisites** (confirm before running — if not met, instruct the user):
- Docker services running: `pnpm db:dev:up`
- Migrations applied: `pnpm db:migrate`
- `.env` has `DEV_OTP_MASTER=9999` and `NODE_ENV=test`

### When a test fails

1. Read the full error output — look at the actual HTTP status code and the response body (`res.body`)
2. If a test expects 404 but gets 400: check if a UUID in the request body is valid v4 format
3. If a test expects 200 but gets 401: confirm the access token is being passed in the Authorization header
4. If a test expects 201 but gets 409: a prior test may have created the same resource — ensure `uniquePhone()` or similar is used for test isolation
5. If the service throws something unexpected: read `src/api/<module>/<module>.service.ts` to find the actual exception
6. Fix the test (wrong expectation) or the source code (real bug) — whichever is correct
7. Re-run until all pass

**DO NOT mark tests as skipped or pending to make the run pass.** Every test must execute and pass.

---

## Step 5 — Report

When all tests pass, output:

```
✓ Integration tests — <module> — N passed, 0 failed

File: tests/integration/<module>.integration.spec.ts
Endpoints covered: N
Status codes covered: <list>

Run: npx jest --config jest.integration.config.ts --runInBand --forceExit --testPathPatterns="<module>.integration"
```

If a known limitation prevented testing a specific status code path (e.g. resend-otp 200 blocked by cooldown), document it explicitly:

```
Known untested path: POST /v1/auth/resend-otp 200 — blocked by 60s cooldown with no test bypass
```

---

## Coverage Reference

| Endpoint type | Status codes to test |
|---|---|
| `POST` (create) | 201, 400, 401, 409 (if unique constraint), 429 (if rate-limited) |
| `POST` (action) | 200, 400, 401, 404 (if resource must exist), 409 (if state conflict) |
| `GET` (list) | 200, 401 |
| `GET` (single) | 200, 401, 404 |
| `PATCH` / `PUT` | 200, 400, 401, 404, 409 (if conflict) |
| `DELETE` | 204, 401, 404 |
| External service endpoint | add 503 |
