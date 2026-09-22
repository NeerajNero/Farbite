---
name: backend:best-practices
description: Best practices and recommendations for backend development (auth, cookies, tokens, API shape, DTOs, Swagger, error handling)
---

# Backend Patterns — Recommendations

> **Purpose.** A catalog of NestJS backend patterns recommended for `app`. Covers auth/cookies/tokens (sections 1–8) and wider conventions (sections 9–14: API shape, DTOs, response envelope, Swagger system, validation constants, exception filter). Each section: what the pattern is, why it's useful, how `app` looks today, and what to add.
>
> **Target.** `./src`
>
> **Sections:**
> - **Part A — Auth / Cookies / Tokens** (sections 1–8)
> - **Part B — Wider patterns** (sections 9–14): API envelope, Swagger system, validation constants, transforms, role guard, exception filter

---

## TL;DR — what's worth porting

### Part A — Auth / Cookies / Tokens

| Pattern | Recommended | app has it | Notes |
|---|---|---|---|
| Centralized `CookieService` (vs ad-hoc helper) | ✅ | ❌ (ad-hoc helper at `auth/helpers/cookie.helper.ts`) | **Yes** — consolidates cookie names + options + lifetime |
| Three-token system (access / refresh / **temp**) | ✅ | ❌ (only access + refresh) | **Yes** — temp tokens are the right primitive for OTP flows |
| `@Secure([AuthType])` decorator + dispatcher guard | ✅ | ❌ (uses separate guards per route) | **Yes** — one decorator, multiple strategies |
| Token-purpose guard (`@TokenPurposeWithGuard(PASSWORD_RESET)`) | ✅ | ❌ | **Yes** — prevents temp-token reuse across flows |
| `isMobileRequest(req)` web/mobile branching | ✅ | ❌ | **Maybe** — only if you ship a native mobile client |
| Domain-aware cookie (e.g. `.example.com` for cross-subdomain sharing) | ✅ | ⚠️ (env-driven but unused — `COOKIE_DOMAIN`) | **Yes** — needed for multi-subdomain setups |
| Cookie middleware injects `Authorization: Bearer` | ✅ | ✅ (already present, plus admin variant) | Already done |
| Three passport strategies (jwt, refresh, temp) | ✅ | ⚠️ (only jwt; refresh handled in service) | **Yes** — cleaner than mixing |

### Part B — Wider patterns (API / DTOs / Enums / Swagger / Errors)

| Pattern | Recommended | app has it | Notes |
|---|---|---|---|
| Standardised `ApiResponse<T>` envelope (`status_code/status/message/data/error`) | ✅ | ⚠️ (TransformInterceptor wraps responses, but no shared base class) | **Yes** — gives Swagger a single response schema; client SDK gets typed envelopes |
| `ResponseUtil.success()` / `ResponseUtil.error()` helpers | ✅ | ✅ already at `common/helpers/response.utils.ts` | Already done |
| Per-module `*Swagger` object + `*SwaggerDecorator(endpoint)` | ✅ | ❌ (each controller hand-rolls `@ApiOperation`/`@ApiResponse` inline) | **Yes** — controllers stay tight; Swagger schema lives in one file per module |
| `ApiResponse`-extending `*ApiResponse` classes per endpoint (`LoginApiResponse extends ApiResponseClass<LoginResponseDto>`) | ✅ | ❌ | **Yes** — SDK generator picks up nested `data: T` correctly |
| Centralised `FIELD_DESCRIPTIONS` + `REGEX_PATTERNS` constants | ✅ | ❌ (duplicated regex strings in DTOs) | **Yes** — one source of truth for validation, less drift |
| Centralised `APP_STRINGS` for messages + error texts | ✅ | ❌ (string literals scattered in services) | **Maybe** — i18n-ready but adds indirection. Skip if you're not localising |
| `*Transform` class per module (`TagsTransform.transformToTagDto(row)`) | ✅ | ⚠️ (some inline mapping in services) | **Maybe** — useful when entity → DTO is non-trivial. Skip when it's `{...row}` |
| `User` param decorator with type-safe field picking (`@User('id')` returns `string`) | ✅ | ✅ already at `auth/decorators/current-user.decorator.ts` | Mostly done — could add the `keyof` typing for picked fields |
| Custom `HttpExceptionFilter` mapping all NestJS exceptions to `ApiResponse` | ✅ | ⚠️ (has filter, less comprehensive) | **Yes** — closes gaps where bare `BadRequestException` returns NestJS default shape |
| `RouteNames` enum centralising all paths | ✅ | ✅ already at `common/route-names.ts` | Already done |
| Pagination helper + response factory (`getPaginationDetails`, `PaginatedResponseDto`) | ✅ | ✅ at `common/pagination/` (`pagination.util.ts` + `pagination.dto.ts`) — `{ items, pagination }` shape | Already done — see `backend:pagination` |

**Recommended adoption order** (smallest blast radius first):
1. Auth: cookie service → temp tokens → token-purpose guard → @Secure decorator (Part A — see step list at the bottom)
2. Wider: `FIELD_DESCRIPTIONS`/`REGEX_PATTERNS` constants → `*Swagger` decorator pattern → `*ApiResponse` envelope classes → `HttpExceptionFilter` upgrade

---

# Part A — Auth / Cookies / Tokens

## 1. Cookie service

### What it is

A single `CookieService` (`@Injectable()`) that owns all cookie writes/reads. Reads cookie config from env once, exposes `setAuthCookies / deleteAuthCookies / deleteAllCookies / setGuestCookie`.

### Reference structure

- `src/common/services/cookie.service.ts` — the service
- `src/common/types/auth.types.ts:40` — `ICookieOptions` interface
- `src/common/helpers/helpers.ts:32` — `extractRootDomain()` to convert `https://app.example.com` → `.example.com` for cross-subdomain cookies
- `src/middlewares/cookies.middleware.ts` — reads cookies and injects `Authorization: Bearer` header

### Why it's useful

1. **Single source of cookie option truth.** Every flow that touches cookies (login, refresh, OTP, password reset, logout) goes through the service — no drift between "the helper" and "the controller doing it directly."
2. **Per-token max-age.** Access/refresh/temp each have their own expiry from env (`JWT_ACCESS_TOKEN_EXPIRY * 1000`).
3. **Env-aware `secure` and `sameSite`.** Production/staging → `secure: true`, `sameSite: 'none'`. Development → `secure: false`, `sameSite: 'strict'`.
4. **Domain extraction**. The `extractRootDomain` helper turns the FE app URL into a leading-dot domain so the cookie is shared across subdomains (admin/resident/api).
5. **`deleteAllCookies(req, res)`** for nuclear logout — iterates `req.cookies` and clears each. Useful when temp + access cookies coexist mid-flow.

### Comparison to app today

`src/auth/helpers/cookie.helper.ts` is a 38-line module-scoped helper:
- Hard-coded cookie names: `access_token` and `refresh_token`
- Hard-coded max-age: 24h access / 30d refresh
- Takes `{ isProd, domain }` as a parameter every call (caller's responsibility to pass)
- No `temp` cookie support
- No `setGuestCookie`

The middleware (`src/middlewares/cookies.middleware.ts`) reads from cookie names `sid`, `refresh_token`, `temp_sid` (and admin variants), but the helper sets `access_token` and `refresh_token`. **Names don't match.** This is a real bug — set a cookie, the middleware doesn't read it.

### What to keep from old, what to drop

**Keep:**
- `@Injectable()` service-based design
- `ICookieOptions` + `transformCookieOptions(options)` — the snake_case → camelCase translator is overkill; just use camelCase throughout
- Domain extraction helper
- `deleteAllCookies` for hard logout

**Drop / change:**
- `secure: NODE_ENV === 'production' || NODE_ENV === 'staging'` should be `NODE_ENV !== 'development'`
- Cookie names should match what we already read in the middleware (`sid`, `refresh_token`, `temp_sid`) — or update the middleware. **Pick one and stick to it.**
- Use NestJS `Logger` properly — old code calls `Logger.log(...)` statically inside a constructor without context

### Files to create in app

```
src/common/services/cookie.service.ts        # ports CookieService, env-driven
src/common/helpers/extract-root-domain.ts    # the helper alone (small)
```

And **delete** `src/auth/helpers/cookie.helper.ts` after migrating callers.

---

## 2. Three-token system (access / refresh / temp)

### What it is

Three distinct JWT secrets and three distinct lifetimes:
- **Access token** — short-lived (~15 min), carries `{ sub, role, type: 'access' }`
- **Refresh token** — long-lived (~30 days), carries `{ sub, type: 'refresh' }`
- **Temp token** — short-lived (~10–15 min), carries `{ sub, purpose, type: 'temp', otp_id? }`

Each has its own secret in env: `JWT_ACCESS_TOKEN_SECRET`, `JWT_REFRESH_TOKEN_SECRET`, `JWT_TEMP_TOKEN_SECRET`. Compromising one type cannot forge another.

### Reference structure

- `src/common/services/jwt.service.ts` — `CustomJwtService` with `generateAuthToken / generateRefreshToken / createTempToken / verifyAccessToken / verifyTempToken`
- `src/api/auth/services/token-factory.service.ts` — `TokenFactoryService` that wraps the JWT service into auth-flow primitives (`createUserTokens`, `createTempToken`, `createAccessToken`, `createRefreshToken`)
- `src/common/types/auth.types.ts` — `AccessTokenPayload`, `RefreshTokenPayload`, `TempTokenPayload`

### Why it's useful — the temp token is the killer feature

The temp token is what makes OTP flows clean. Currently in app, OTP state is held in Redis and the user provides email+OTP every step. With a temp token:

1. `POST /auth/forgot-password { email }` → server sends OTP, returns **temp token** with `purpose: OTP_VERIFICATION` and `otp_id: ...`
2. `POST /auth/verify-otp` (Authorization: temp token) `{ otp }` → server verifies, returns a NEW temp token with `purpose: PASSWORD_RESET`
3. `POST /auth/reset-password` (Authorization: temp token) `{ newPassword }` → server checks `purpose === PASSWORD_RESET`, applies

Benefits:
- No need to re-send the email each step
- Server-side state (in the JWT signature) instead of Redis-only
- `purpose` field prevents using a "verify-otp" token to call "reset-password" directly (token-purpose guard enforces this)
- Naturally expires — no need for cleanup jobs

### Comparison to app today

app has:
- Access token (handled by `@nestjs/jwt` directly, no wrapper)
- Refresh token (stored in `app.refresh_tokens` table with rotation; nice and stateful)
- **No temp tokens.** OTP flow uses Redis with prefixes (`auth:otp:register:`, `auth:otp:cooldown:`, `auth:otp:attempts:`) and re-validates email+OTP at each step.

App's Redis-based flow is fine but couples the auth flow to Redis availability. Temp tokens decouple it.

### What to keep, what to drop

**Keep:**
- Three separate secrets + expiries
- Strongly typed payloads (`AccessTokenPayload`, etc.) with `type` literal field for runtime tagging
- `TokenFactoryService` as a wrapper over `CustomJwtService` — the factory is the auth-flow API, the JWT service is the primitive

**Drop / change:**
- A purely-stateless approach (trust the JWT signature, no DB record) is one option, but app already tracks refresh tokens server-side in `app.refresh_tokens` with session IDs and rotation — **keep that**, it's stricter.

### Files to create in app

```
src/common/services/custom-jwt.service.ts    # ports CustomJwtService — primitive JWT operations
src/auth/services/token-factory.service.ts   # auth-flow wrapper (replaces ad-hoc token logic)
src/auth/interfaces/token-payloads.interface.ts  # AccessTokenPayload + TempTokenPayload + RefreshTokenPayload
```

Add to `env.config.ts`:
```
JWT_TEMP_TOKEN_SECRET, JWT_TEMP_TOKEN_EXPIRY
```

---

## 3. `@Secure([AuthType])` decorator + multi-strategy dispatcher

### What it is

A single decorator that says "this endpoint accepts these auth types":

```ts
@Secure([AuthType.NONE])             // public
@Secure([AuthType.JWT])              // logged-in user
@Secure([AuthType.REFRESH])          // refresh-token endpoint
@Secure([AuthType.TEMP])             // OTP/reset endpoint
@Secure([AuthType.JWT], [RoleType.ADMIN])  // logged-in + role
```

Behind the scenes, an `AuthenticationGuard` reads the metadata, looks up the right passport strategy guard, and calls it. The first one that succeeds wins.

### Reference structure

- `src/common/enums/auth-type.enum.ts` — `enum AuthType { JWT, REFRESH, TEMP, NONE }`
- `src/api/auth/decorators/secure.decorator.ts` — `Secure(authTypes, roles?)`
- `src/api/auth/decorators/auth.decorator.ts` — base `Auth(authTypes)` (not used much; superseded by Secure)
- `src/api/auth/guards/authentication.guard.ts` — the dispatcher. Maps `AuthType.JWT` → `JwtAuthGuard`, `AuthType.REFRESH` → `RefreshAuthGuard`, etc.

### Why it's useful

1. **Endpoint intent at a glance.** Reading `@Secure([AuthType.TEMP])` is clearer than `@UseGuards(TempAuthGuard)`.
2. **Multiple acceptable types.** `@Secure([AuthType.JWT, AuthType.REFRESH])` lets an endpoint accept either — handy for `/me` style endpoints that should work mid-refresh.
3. **`AuthType.NONE` is the same vocabulary as the rest** — no need for a separate `@Public()` decorator.
4. **Roles are layered, not co-mingled.** `@Secure([AuthType.JWT], [RoleType.ADMIN])` applies the auth guard *and* the roles guard; if you don't pass roles, the roles guard isn't even instantiated.

### Comparison to app today

app uses NestJS-standard decorators: `@Public()` (skip auth), `@Roles('admin')`, plus the global `JwtAuthGuard`. Refresh-token endpoints currently bypass via `@Public()` and read the cookie manually in the controller — that's brittle (controller has to know about cookie names, refresh logic, etc.).

There's no temp-auth guard at all. There's no way to say "this endpoint accepts a refresh token."

### What to keep, what to drop

**Keep:**
- The dispatcher pattern with `authTypeGuardMap` — cleaner than passport's strategy-name-string approach
- Layered roles via the same decorator

**Drop / change:**
- `AuthType.NONE` having `canActivate: () => true` — a no-op guard is fine but verbose; app's `@Public()` decorator with the IS_PUBLIC reflector key works equally well. Pick the convention you prefer; don't run both.

### Files to create in app

```
src/common/enums/auth-type.enum.ts
src/auth/decorators/secure.decorator.ts          # replaces ad-hoc combinations of @Public + @Roles
src/api/auth/guards/authentication.guard.ts          # multi-strategy dispatcher
src/auth/strategies/refresh-token/refresh.strategy.ts   # passport strategy + guard
src/auth/strategies/temp-token/temp.strategy.ts          # passport strategy + guard
```

Note: app's existing `@Roles(...)` and `RolesGuard` keep working unchanged inside the dispatcher.

---

## 4. Token purpose pattern

### What it is

A second-layer guard that runs *after* `AuthenticationGuard` accepts a temp token. It checks that the temp token's `purpose` field matches what the endpoint expects.

```ts
@Post('verify-otp')
@Secure([AuthType.TEMP])
@TokenPurposeWithGuard(TokenPurposeEnum.OTP_VERIFICATION)
async verifyOtp(...) { ... }

@Post('reset-password')
@Secure([AuthType.TEMP])
@TokenPurposeWithGuard(TokenPurposeEnum.PASSWORD_RESET)
async resetPassword(...) { ... }
```

If a user sends a token with `purpose: 'OTP_VERIFICATION'` to the reset-password endpoint, the guard 401s before any handler code runs.

### Reference structure

- `src/common/enums/token-purpose.enum.ts` — `enum TokenPurposeEnum { OTP_VERIFICATION, PASSWORD_RESET, REGISTRATION, SET_PASSWORD }`
- `src/api/auth/decorators/token-purpose.decorator.ts` — `TokenPurposeWithGuard(purpose)`
- `src/api/auth/guards/token-purpose.guard.ts` — runs after temp-auth, compares `req.user.purpose` to the metadata

### Why it's useful

Without this, a user who completes "verify OTP" gets a temp token they could replay against any temp-protected endpoint — including ones they shouldn't reach yet (e.g., a `change-email` endpoint). The purpose field locks each token to a specific stage of a specific flow.

It's small but it's the difference between "we have OTP security" and "we have OTP security with no privilege escalation".

### Comparison to app today

Doesn't exist. The current OTP flow at `auth.service.ts:80-169` re-validates email+OTP at each call to `completeResidentRegistration`, which sidesteps the problem — but that means every protected step needs the email+OTP redelivered, and Redis is on the hot path.

If/when temp tokens land, you need this guard immediately. Don't ship temp tokens without it.

### Files to create in app

```
src/common/enums/token-purpose.enum.ts
src/auth/decorators/token-purpose.decorator.ts
src/api/auth/guards/token-purpose.guard.ts
```

---

## 5. Mobile vs web detection

### What it is

`isMobileRequest(req)` — a one-line helper that returns `req.headers['x-device'] === 'mobile'`. Used in the auth controller to decide whether to set cookies or just return tokens in the body.

```ts
if (!isMobileRequest(req)) {
  this.cookieService.setAuthCookies(res, accessToken, refreshToken);
}
return ResponseUtil.success({ tokens, user });
```

### Reference structure

- `src/common/helpers/helpers.ts:50` — the helper
- Used in every auth-controller endpoint that issues tokens

### Why it's useful

Mobile clients (React Native, native iOS/Android) can't use cookies easily — they want the tokens in the response body. Web clients (admin/resident apps) want cookies for httpOnly safety. Branching once at the controller is much cleaner than two endpoint variants.

### Comparison to app today

App doesn't have a mobile client today, so this is **not urgent**. The endpoints set cookies unconditionally and also return tokens in the response body — which is fine but slightly wasteful for web (the FE never reads the body tokens).

### Recommendation

Skip until app gets a native mobile client. When you add one, port the helper and gate the cookie writes.

---

## 6. Three passport strategies

### What it is

Three `PassportStrategy` classes, one per token type:

- `JwtStrategy` — extracts from `Authorization: Bearer`, verifies with `JWT_ACCESS_TOKEN_SECRET`. `validate()` returns `{ id, role }`.
- `RefreshStrategy` — extracts from `Authorization: Bearer`, verifies with `JWT_REFRESH_TOKEN_SECRET`. `validate()` returns `{ id }`.
- `TempStrategy` — extracts from `Authorization: Bearer`, verifies with `JWT_TEMP_TOKEN_SECRET`. `validate()` returns `{ id, purpose, otp_id }`.

Each has a matching `*AuthGuard` that calls the strategy.

### Reference structure

```
src/api/auth/strategies/jwt-token/jwt.strategy.ts       jwt-auth.guard.ts
src/api/auth/strategies/refresh-token/refresh-strategy.ts  refresh-auth.guard.ts
src/api/auth/strategies/temp-token/temp.strategy.ts        temp-auth.guard.ts
```

### Why it's useful

- The cookie middleware injects `Authorization: Bearer <whichever-token>`, so the strategies don't care whether the token came from a header or a cookie.
- The dispatcher (`AuthenticationGuard`) tries each in turn — the right secret verifies the right token.
- Token-payload validation is centralised in `validate()` per strategy.

### Comparison to app today

app has only `JwtAuthGuard` (its own implementation, not passport-based). The refresh-token endpoint at `auth.controller.ts:154-161` reads the cookie manually and calls `authService.refreshTokens(refreshToken)` directly — no guard. This means:
- The refresh endpoint is `@Public()`, which is fine but means every guard layer must be skipped for it
- There's no parallel "temp" strategy at all

### Files to create in app

```
src/auth/strategies/refresh-token/refresh.strategy.ts
src/auth/strategies/refresh-token/refresh-auth.guard.ts
src/auth/strategies/temp-token/temp.strategy.ts
src/auth/strategies/temp-token/temp-auth.guard.ts
```

The existing `JwtAuthGuard` can stay; just register it as `AuthType.JWT → JwtAuthGuard` in the dispatcher.

---

## 7. main.ts wiring

### Recommended setup

```ts
app.use(helmet());
app.enableCors({
  origin: corsOrigins,            // env-driven list
  credentials: true,              // <- needed for cookies cross-origin
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
  allowedHeaders: 'Content-Type, Accept, Authorization, x-landing-app-id, x-forwarded-for, x-device-id, x-device',
});
app.use(bodyParser.json({ limit: '1mb' }));
app.use(cookieParser());
app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
```

### Comparison to app today

`src/main.ts` already does helmet, CORS, cookie-parser, and URI versioning. **Already aligned** — no changes needed unless you add the `x-device` header for the mobile detection helper.

---

## 8. Auth flow inventory (what endpoints exist)

A reference `AuthController` typically has these endpoints — useful as a checklist for what app might still need:

| Endpoint | Auth | Purpose |
|---|---|---|
| `POST /auth/login` | NONE | email/password login → access+refresh cookies + body |
| `POST /auth/set-password` | NONE | invited user sets first password (uses temp token in header) |
| `POST /auth/forgot-password` | NONE | sends OTP, returns temp token (`OTP_VERIFICATION`) |
| `POST /auth/verify-otp` | TEMP + `OTP_VERIFICATION` | swaps OTP-verify temp → password-reset temp |
| `POST /auth/reset-password` | TEMP + `PASSWORD_RESET` | applies new password |
| `POST /auth/refresh-token` | REFRESH | issues new access token |
| `POST /auth/logout` | NONE | clears all cookies |
| `POST /auth/resend-otp` | NONE | re-issues OTP (returns new temp token with same purpose) |

app auth controller has its own set (initiate/resend/complete for resident registration; admin/resident login; accept-invite; etc.). The flows are different — but the **shape** of using temp tokens for multi-step flows is the upgrade.

---

# Part B — Wider patterns

## 9. Standardised `ApiResponse<T>` envelope

### What it is

A single base class every endpoint extends so all responses share the same outer shape:

```ts
// common/dto/api-response.ts
export class ApiResponse<T> {
  @ApiProperty({ example: 200 })       status_code: number;
  @ApiProperty({ example: 'Success' }) status: string;
  @ApiProperty({ example: 'Operation completed successfully' }) message: string;
  @ApiProperty({ required: false, nullable: true }) data?: T;
  @ApiProperty({ required: false, nullable: true }) error?: string;
}
```

Each endpoint's response DTO extends it with the `data` field re-typed via `declare`:

```ts
export class LoginApiResponse extends ApiResponseClass<LoginResponseDto> {
  @ApiPropertyOptional({ type: LoginResponseDto })
  declare data?: LoginResponseDto;
}
```

The controller wraps via `ResponseUtil.success(data, message, statusCode)` which returns an `ApiResponse<T>`.

### Reference structure

- `src/common/dto/api-response.ts` — base class
- `src/common/helpers/response.utils.ts` — `ResponseUtil.success` / `.error`
- Per-module `dtos/*-response.dto.ts` — each endpoint's response class
- Used everywhere: `controller.method(): Promise<LoginApiResponse>` and `return ResponseUtil.success(...)`

### Why it's useful

1. **Swagger gets a single response schema.** Without this, every endpoint shows a different ad-hoc shape.
2. **SDK generator (`openapi-generator-cli`) outputs typed envelopes** — `client.login()` returns `LoginApiResponse` not just `LoginResponseDto`, so the FE can read `response.data.tokens.access_token` with full types.
3. **Error handling is uniform.** `error?: string` is always present on failures, so the FE can do `if (!response.data) ...` safely.
4. **The `declare data?: T` trick** keeps Swagger happy — `ApiPropertyOptional({ type: LoginResponseDto })` overrides the generic on the subclass.

### Comparison to app today — RESOLVED

This gap has been closed. app has:
- `common/dto/api-response.ts` — `ApiResponse<T>` is now a class with `@ApiProperty` on every field (`statusCode`, `status`, `message`, `error`, `traceId`, `meta`)
- `common/helpers/response.utils.ts` (`ResponseUtil.success/error`)
- A global `TransformInterceptor` that wraps any controller return value into the envelope
- `common/decorators/api-enveloped-response.decorator.ts` — `ApiEnvelopedResponse(status, description, Model, options?)`, applied to every success response

Previously the interceptor did the wrapping at runtime but **Swagger didn't see it** — endpoints declared `Promise<LoginResponseDto>` and Swagger rendered that as the full response, not an envelope, so the generated SDK deserialized fields straight off the envelope instead of `envelope.data` (e.g. `phone: undefined`, `expiresAt: Invalid Date` on `/v1/auth/sign-up`). Fixed by documenting the real envelope shape per endpoint instead of migrating every controller to return a concrete envelope subclass.

### What to keep, what to drop

**Keep:**
- `ApiEnvelopedResponse(status, description, Model, options?)` on every success response with a body DTO — see `backend:swagger` Rule 2.2/2.4
- `ResponseUtil.success/error`
- Controllers keep returning the bare DTO (`Promise<LoginResponseDto>`) — the interceptor does the actual wrapping at runtime; only the Swagger *documentation* changes
- The auto-wrapping `TransformInterceptor` — it's the single source of truth for the runtime envelope, keep it

**Dropped:**
- The `*ApiResponse extends ApiResponseClass<X>` per-DTO subclass approach this section originally proposed. `ApiEnvelopedResponse` gets the same correct OpenAPI schema without a second class per response DTO, and without changing every controller's return type.
- Field naming: app uses camelCase (`statusCode`, `data`) — unchanged, matches the rest of app DTOs.

### Files already in place

```
src/common/dto/api-response.ts                          # ApiResponse<T> class with @ApiProperty
src/common/decorators/api-enveloped-response.decorator.ts  # ApiEnvelopedResponse(status, description, Model, options?)
```

New endpoints: annotate success responses with `@ApiEnvelopedResponse(...)` (see `backend:swagger` Rule 2.2) — no new DTO subclass needed.

---

## 10. Per-module Swagger object + `*SwaggerDecorator`

### What it is

Each module owns a `*.swagger.ts` file that exports a single object holding all OpenAPI metadata for the module's endpoints, organised by endpoint name:

```ts
// api/auth/swagger/auth.swagger.ts
export const AuthSwagger = {
  tags: () => ApiTags('Auth'),
  bearerAuth: () => ApiBearerAuth(),

  login: {
    operation: () => ApiOperation({ summary: '...', description: '...' }),
    body: () => ApiBody({ type: LoginRequestDto }),
    responses: () => [
      ApiEnvelopedResponse(201, '...', LoginResponseDto),
      ApiResponse({ status: 404, description: 'No account found' }),
      ApiResponse({ status: 403, description: 'Account disabled' }),
      ApiResponse({ status: 400, description: 'Invalid request data' }),
    ],
  },

  forgotPassword: { operation: ..., responses: ... },
  // ...one entry per endpoint
};
```

Then a tiny `*SwaggerDecorator` glues them onto handlers:

```ts
// api/auth/decorators/swagger.decorator.ts
export function AuthSwaggerDecorator(endpoint: keyof typeof AuthSwagger) {
  const cfg = AuthSwagger[endpoint] as SwaggerEndpoint;
  const decorators = [cfg.operation(), ...cfg.responses()];
  if (cfg.headers) decorators.push(...cfg.headers());
  return applyDecorators(...decorators);
}
```

Controller usage stays clean:

```ts
@Controller(RouteNames.AUTH)
@AuthSwagger.tags()
@AuthSwagger.bearerAuth()
export class AuthController {
  @Post('login')
  @Secure([AuthType.NONE])
  @AuthSwaggerDecorator('login')
  async login(...) { ... }
}
```

### Reference structure

- `src/api/<module>/swagger/<module>.swagger.ts` — every module has one
- `src/api/<module>/decorators/swagger.decorator.ts` — the glue function
- Examples: `auth/swagger/auth.swagger.ts`, `tags/swagger/tags.swagger.ts`

### Why it's useful

1. **Controllers stay readable.** A 4-line endpoint with one `@AuthSwaggerDecorator('login')` is easier to scan than 20 lines of inline `@ApiOperation` + 5× `@ApiResponse`.
2. **Swagger docs live in one file per module.** When a PM/QA opens `auth.swagger.ts` they see all auth endpoints in 200 lines. Hunting through controllers loses that.
3. **Reusable response sets.** You can extract `commonAuthErrors()` returning the 401/403/400 trio and spread it into every endpoint's `responses`.
4. **Type-safe endpoint name.** `keyof typeof AuthSwagger` means `@AuthSwaggerDecorator('logn')` won't compile.

### Comparison to app today

Each app controller has inline `@ApiOperation`, `@ApiResponse` — see `auth.controller.ts` (35 `@ApiResponse` calls) or `admin/individual-resident-management.controller.ts`. Readable for small modules, gets dense for big ones. Updating a response shape means hunting across the controller file.

### What to keep, what to drop

**Keep:**
- The `<module>Swagger` object pattern
- The `<module>SwaggerDecorator(endpoint)` glue
- `keyof typeof` for type safety

**Drop / change:**
- Some implementations split this into two folders (`<module>/decorators/swagger.decorator.ts` for the glue and `<module>/swagger/<module>.swagger.ts` for the data). **Combine** them — put both in `<module>/swagger/<module>.swagger.ts` so each module has a single `swagger/` folder with one file.

### Files to create in app

For every module that has more than ~3 endpoints:

```
src/<module>/swagger/<module>.swagger.ts          # the Swagger object + decorator function
```

Don't migrate all modules at once — pick one (e.g., `auth`) as a pilot, prove the pattern, then convert others over time.

---

## 11. Centralised `FIELD_DESCRIPTIONS` + `REGEX_PATTERNS`

### What it is

Two big constant maps, used everywhere DTOs need a description, example, or regex:

```ts
// common/constants/validation.constants.ts
export const FIELD_DESCRIPTIONS = {
  COMMON: {
    ID: { LABEL: 'ID', DESCRIPTION: 'Unique identifier', EXAMPLE: '123e4567-...' },
    CREATED_AT: { LABEL: 'Created at', DESCRIPTION: '...', EXAMPLE: '2024-01-01T00:00:00.000Z' },
    UPDATED_AT: { ... },
    ROLES: { ... },
  },
  EMAIL: { LABEL: 'Email address', DESCRIPTION: '...', EXAMPLE: 'admin@example.com' },
  PASSWORD: {
    DESCRIPTION: '...',
    EXAMPLE: 'P@ssw0rd!',
    CURRENT: { DESCRIPTION: '...', EXAMPLE: '...' },
    NEW:     { DESCRIPTION: '...', EXAMPLE: '...' },
    CONFIRM: { DESCRIPTION: '...', EXAMPLE: '...' },
  },
  PHONE_NUMBER: { ... },
  COUNTRY_CODE: { ... },
  // ...30+ field groups
} as const;

export const REGEX_PATTERNS = {
  PHONE_NUMBER: /^[0-9]{10}$/,
  COUNTRY_CODE: /^\+[0-9]{1,3}$/,
  PASSWORD: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@#$&])[A-Za-z\d@#$&]{8,20}$/,
  URL: /^(https?:\/\/)?(...)/,
  OTP: /^\d{6}$/,
  TAG_NAME: /^(...)$/,
} as const;
```

DTOs reference them:

```ts
@ApiProperty({
  description: FIELD_DESCRIPTIONS.EMAIL.DESCRIPTION,
  example: FIELD_DESCRIPTIONS.EMAIL.EXAMPLE,
})
@IsEmail()
email: string;

@Matches(REGEX_PATTERNS.PASSWORD, { message: 'Invalid password format' })
password: string;
```

### Reference structure

- `src/common/constants/validation.constants.ts` — both maps in one file (~480 lines)
- Imported in every DTO that needs a description, example, or regex

### Why it's useful

1. **One source of truth** for what an "email" looks like — description, example, validation. If you change the email regex, every DTO that references `REGEX_PATTERNS.EMAIL` updates automatically.
2. **Swagger looks consistent.** Every "id" field has the same description and example UUID across all endpoints.
3. **Easy to localise** later if you swap descriptions for translation keys.
4. **Lint-friendly.** No more "is this email regex the same as that email regex?" diff fatigue.

### Comparison to app today

app DTOs hand-roll descriptions and examples:

```ts
@ApiProperty({ example: '+14151234567' })
@Matches(/^\+[0-9]{10,15}$/)
phone?: string;
```

The same regex appears in `pd/residents/dto/create-resident.dto.ts:39`, `users/dto/create-user.dto.ts`, etc. with subtle differences. Real drift. The recent move from `@IsEnum(['CA-1','CA-2','CA-3'])` to dynamic catalog validation hits this too.

### What to keep, what to drop

**Keep:**
- The two-map structure (descriptions + regexes)
- `as const` so TypeScript narrows literal types
- Nested groups (`PASSWORD.CURRENT`, `PASSWORD.NEW`)

**Drop / change:**
- Some references include a `LABEL` field per group — drop it and keep just `DESCRIPTION` + `EXAMPLE` (consistent across all entries)
- Don't include placeholder/error message text here; keep that in `APP_STRINGS` (or a future `i18n` system)

### Files to create in app

```
src/common/constants/validation.constants.ts     # FIELD_DESCRIPTIONS + REGEX_PATTERNS
```

Migrate gradually: when you touch a DTO, swap its hand-rolled descriptions/regexes to references. Don't do a big-bang refactor.

---

## 12. `*Transform` class per module

### What it is

A dedicated `*Transform` class per module that converts DB rows / entities into response DTOs:

```ts
// api/tags/tags.transform.ts
export class TagsTransform {
  transformToTagDto(tag: any): TagDto {
    return { id: tag.id, name: tag.name, is_active: tag.is_active };
  }

  transformTagsForList(tags: any[]): TagDto[] {
    return tags.map(t => this.transformToTagDto(t));
  }

  transformTagsForPaginated(tags: any[], total, page, limit): TagPaginatedResponseDto {
    const totalPages = Math.ceil(total / limit);
    return { tags: this.transformTagsForList(tags), total, current_page: page, limit, total_pages: totalPages };
  }
}
```

The service calls it:

```ts
constructor(private readonly tagsTransform: TagsTransform) {}

async findAll() {
  const rows = await this.tagsDb.findMany();
  return this.tagsTransform.transformTagsForPaginated(rows, total, page, limit);
}
```

### Reference structure

- `src/api/<module>/<module>.transform.ts` per module
- Registered in the module's `providers: [TagsTransform]`

### Why it's useful

1. **Single place to drop sensitive fields** (`password_hash`, `deleted_at`) before responding. Less risk of leaking by accident.
2. **DB row shape and API response shape are decoupled** — refactor the schema without breaking clients.
3. **Reusable across endpoints** — `transformToTagDto` used by both `findOne` and `findAll`.

### Comparison to app today

Most app services do inline mapping:

```ts
return {
  id: row.id,
  firstName: row.first_name,
  lastName: row.last_name,
  // ...
};
```

For simple entities this is fine. For ones with nested relations, sensitive fields, or multiple response shapes (list / detail / summary), a Transform class pays for itself.

### What to keep, what to drop

**Keep:**
- One `*Transform` class per module that needs it (i.e., when entity ≠ response)

**Drop / change:**
- Don't make it for every module. If your entity is `{...row}` already, skip. Use it where it earns its keep.
- Avoid `any` for input — type the DB row shape explicitly: `transformToTagDto(tag: TagRow): TagDto`.

### Files to create in app

Optional, on a per-module basis:

```
src/<module>/<module>.transform.ts
```

For app specifically, useful candidates: `users` (strip `password_hash`, `deleted_at`), `pd/residents` (multiple response shapes — list/detail/summary already exist), `auth` (the new `AuthSuccessResponseDto` mapping logic in `issueSession` could move here).

---

## 13. `RoleType` enum + roles guard pattern

### What it is

Three pieces:

```ts
// common/enums/role-type.enum.ts
export enum RoleType {
  ADMIN = 'ADMIN',
  EDITOR = 'EDITOR',
  CONTRIBUTOR = 'CONTRIBUTOR',
}

// auth/decorators/roles.decorator.ts
export const ROLES_KEY = 'roles';
export const Roles = (...roles: RoleType[]) => SetMetadata(ROLES_KEY, roles);

// auth/guards/roles.guard.ts
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}
  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<RoleType[]>(ROLES_KEY, [
      context.getHandler(), context.getClass()
    ]);
    if (!required?.length) return true;
    const user = context.switchToHttp().getRequest().user;
    return required.some(r => user.role === r);
  }
}
```

Used via `@Secure([AuthType.JWT], [RoleType.ADMIN, RoleType.EDITOR])`.

### Reference structure

- `src/common/enums/role-type.enum.ts`
- `src/api/auth/decorators/roles.decorator.ts`
- `src/api/auth/guards/roles.guard.ts`

### Why it's useful

The pattern is mostly identical to NestJS standards. The interesting bit is **the role enum uses uppercase** (`ADMIN` not `admin`). That keeps role values distinct from arbitrary lowercase strings in code, and string comparisons are explicit.

### Comparison to app today

app already has the same three pieces:
- `common/enums/role-type.enum.ts` (lowercase: `admin`, `program_director`, `resident`, `individual_resident`)
- `auth/decorators/roles.decorator.ts`
- `auth/guards/roles.guard.ts`

**Mostly already done.** The only difference is uppercase vs lowercase — and changing it now would be a breaking DB migration (every `app.roles.name` value, every JWT claim). Not worth it.

### Recommendation

No action needed. App's role infrastructure already matches the recommended pattern.

---

## 14. Custom `HttpExceptionFilter`

### What it is

A global filter that catches every `HttpException` and converts it to the standard `ApiResponse` shape. Has explicit handlers for `BadRequest`, `Unauthorized`, `Forbidden`, `NotFound`, `Conflict`:

```ts
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();

    let error: ApiResponse<null>;
    if (exception instanceof BadRequestException)        error = this.handleBadRequest(exception);
    else if (exception instanceof UnauthorizedException) error = this.handleUnauthorized(exception);
    else if (exception instanceof ForbiddenException)    error = this.handleForbidden(exception);
    else if (exception instanceof NotFoundException)     error = this.handleNotFound(exception);
    else if (exception instanceof ConflictException)     error = this.handleConflict(exception);
    else                                                 error = this.handleGenericHttpException(exception);

    response.status(status).json(error);
    return error;
  }

  private handleBadRequest(...): ApiResponse<null> {
    // Pull out class-validator's array of messages, join, wrap
    return { status_code: 400, status: 'Failure', message: '...', error: 'BAD_REQUEST', data: null };
  }
  // ...one per exception type
}
```

Wired in `main.ts` via `app.useGlobalFilters(new HttpExceptionFilter())`.

### Reference structure

- `src/common/filters/http-exception.filter.ts`

### Why it's useful

1. **Errors look like successes** structurally. Same envelope = same FE/SDK handling logic = `if (response.error) showToast(response.message)` works for any endpoint.
2. **`BadRequestException` from class-validator returns its array of messages** by default. The filter joins them into a readable single string while keeping the array in `data` for forms that want field-level errors.
3. **Generic `HttpException` fallback** so unexpected errors don't escape NestJS' default ugly shape.

### Comparison to app today

app has `common/filters/http-exception.filter.ts` and `common/filters/custom-unauthorized-exception.ts`. Quick read: it's less comprehensive than the recommended shape — doesn't have explicit handlers for each NestJS exception type, doesn't always coerce class-validator's message array to a single string.

### What to keep, what to drop

**Keep:**
- One handler per common exception type (Bad/Unauth/Forbidden/NotFound/Conflict)
- The class-validator message-array → joined-string coercion
- Generic fallback for `HttpException`
- Wire as global filter in `main.ts`

**Drop / change:**
- Skip the snake_case (`status_code`); use camelCase to match app convention
- Add `requestId` / `traceId` from the request context — app already has tracing wired up; the filter should propagate the trace id into the error response so support can find the corresponding logs

### Files to update in app

```
src/common/filters/http-exception.filter.ts     # extend with per-type handlers
```

---

## What to NOT adopt

These show up in some NestJS templates but don't fit app:

1. **`setGuestCookie` / guest user flow.** app has no anonymous browsing concept. Skip.
2. **`x-landing-app-id` header tracking.** That was a multi-app rollout thing. Skip.
3. **Static `Logger.log("Cookie Domain set to:", domain)` at construction.** Side-effects in constructors are hard to debug. Use `LoggerService` injected per-instance.
4. **`SET_COOKIE_OPTIONS` snake_case interface (`http_only`, `same_site`).** Translate to camelCase from the start; the `transformCookieOptions` helper in old code is a code smell.
5. **`@nestjs/jwt`'s `JwtModule.register()` global config.** Use per-token secrets via `signAsync({ secret })` like the old `CustomJwtService` does — it's actually better than registering globally.
6. **Snake_case in DTOs (`access_token`, `current_page`, `total_pages`).** Some templates use snake_case in API responses and request bodies. **App uses camelCase consistently** — keep that. Translate field names when adapting any external example.
7. **`APP_STRINGS` global message map.** Useful only if you're localising. For app today, inline strings are fine. Revisit when i18n is on the roadmap.
8. **`@nestjs/swagger`'s `@ApiTags` on every controller as a function call (`@AuthSwagger.tags()`).** The wrapper adds nothing over the standard `@ApiTags('Auth')` — only useful if you anticipate centralised tag renames. Skip the wrapper, keep direct.

---

## Deliberate non-decisions (revisit later)

Items from this doc that we **intentionally have not built** because there's no current consumer. Each entry includes the trigger that should make us reconsider.

### Temp-token primitive + `@Secure([AuthType])` dispatcher + token-purpose guard
> **Status (2026-05-07):** deferred — see priority item P8 in the auth audit (`auth/auth-audit-findings`).

Sections 2 / 3 / 4 / 6 of this doc together describe a stateless temp-token system (third JWT secret, `purpose` claim, multi-strategy auth dispatcher). They earn their keep when:

1. **A second OTP-style flow lands** (e.g. `forgot-password` migrating off Redis state). At that point copy-pasting the IR-signup `otp_verification_codes` approach starts to smell, and a generic temp-token primitive makes more sense than two parallel state stores.
2. **Stateless multi-step flows become valuable** — only true if DB/Redis round-trips per OTP step become a real bottleneck (they aren't today).
3. **Security review demands per-flow secret separation** — externally driven.

Until one of those triggers, the IR-signup flow's DB-row approach (`otp_verification_codes` table with hashed code, `consumed_at`, `attempt_count`) is the established pattern. New OTP flows should follow it, not introduce a new abstraction.

When we DO build this, the prerequisite housekeeping is:

- Standardise on `@Secure([AuthType], [RoleType])` everywhere — either keep the existing `@Public()` + `@Roles()` decorators OR migrate them all in one PR. Don't run both vocabularies in parallel.
- Add the temp-token env vars (`JWT_TEMP_SECRET`, `JWT_TEMP_EXPIRES`) to dev / staging / prod simultaneously.
- Migrate at least one existing flow (`forgot-password` is the natural candidate) so the new primitive has a real consumer rather than sitting unused.

---

## Recommended adoption plan (smallest blast radius first)

If you want to port all of this, the order that minimises risk:

### Step 1 — Fix the cookie name drift (small, urgent)
The current app helper sets `access_token`/`refresh_token` but the middleware reads `sid`/`refresh_token`/`temp_sid`. **One of these is wrong.** Pick a convention. ~30 min.

### Step 2 — Centralize cookies into a service
Create `src/common/services/cookie.service.ts` following the pattern in section 1, with camelCase types. Migrate the two callers (`issueSession`, `logout`). Delete `src/auth/helpers/cookie.helper.ts`. ~1 hour.

### Step 3 — Add temp token primitives
Create `CustomJwtService`, `TokenFactoryService`, payload interfaces. Add env vars. Don't wire to any flow yet. ~1 hour.

### Step 4 — Add temp + refresh passport strategies and guards
Create the strategy classes and guards. Don't change endpoints yet. ~1 hour.

### Step 5 — Add `@Secure([AuthType])` decorator + dispatcher
Create the enum, decorator, dispatcher guard. Migrate ~3 endpoints to it as a pilot (login, refresh, resident dashboard). ~2 hours.

### Step 6 — Add `@TokenPurposeWithGuard` and migrate one OTP flow
Pick one flow (e.g., resident registration: `initiate → resend → complete`) and convert it from Redis-only to temp-token-based. Verify the flow end-to-end. **Keep the Redis flow alive in parallel** so old clients don't break. ~half day.

### Step 7 — Migrate remaining flows + remove Redis-only OTP
Once the new flow is proven, port forgot-password, admin-invite-accept, resident-invite-accept. Remove the OTP Redis state. ~1 day.

**Part A total: 2 working days** if done sequentially, less if parallelised. Each step is independently revertible.

### Part B — wider patterns

These are independent of Part A; can be done in parallel.

### Step B1 — Create `validation.constants.ts`
Add `FIELD_DESCRIPTIONS` + `REGEX_PATTERNS` consts. Don't migrate any DTO yet — just create the file so new DTOs can reference it. ~30 min.

### Step B2 — Convert `ApiResponse` interface to a class
Convert `common/dto/api-response.ts` from interface to class with `@ApiProperty`. Add the `*ApiResponse extends ApiResponseClass<X>` pattern in **one** module (recommend `auth`) as a pilot. Verify the OpenAPI spec at `/api/v1` shows the right schema. **Don't** flip controller return types yet. ~1 hour.

### Step B3 — Decide on `TransformInterceptor` policy
Once `*ApiResponse` is being returned explicitly, the global `TransformInterceptor` either becomes redundant or a safety net. Pick one:
- (a) Keep it; idempotent on already-wrapped responses
- (b) Remove it after migrating all controllers
Recommend (a) for incremental migration safety. ~15 min decision + remove or keep code.

### Step B4 — Pilot the per-module Swagger pattern
Pick one module (recommend `auth` since it has the most endpoints — 8). Create `src/auth/swagger/auth.swagger.ts` with the object + decorator. Migrate all auth controller endpoints to use `@AuthSwaggerDecorator('login')` etc. Compare Swagger before/after. ~half day.

### Step B5 — Upgrade `HttpExceptionFilter`
Add explicit handlers for `BadRequestException` (with class-validator message coercion), `UnauthorizedException`, `ForbiddenException`, `NotFoundException`, `ConflictException`. Make sure the new envelope matches `ApiResponseClass`. Add `traceId` field from request context. ~1 hour.

### Step B6 — (Optional) Per-module `*Transform` classes
Only when entity ≠ response and the mapping is non-trivial. Start with `users` (strip sensitive fields) and the new `auth` `issueSession` mapping. ~per module: 30 min.

**Part B total: ~1 working day** if done sequentially. Cleanly independent of Part A.

**Combined Part A + Part B: ~3 working days total.**

---

## File tree — what to add to app

```
src/
  auth/
    decorators/
      secure.decorator.ts                          # @Secure([AuthType], [RoleType])
      token-purpose.decorator.ts                   # @TokenPurposeWithGuard(...)
    guards/
      authentication.guard.ts                      # multi-strategy dispatcher
      token-purpose.guard.ts                       # purpose-match check
    interfaces/
      token-payloads.interface.ts                  # AccessTokenPayload | RefreshTokenPayload | TempTokenPayload
    services/
      token-factory.service.ts                     # auth-flow wrapper over CustomJwtService
    strategies/
      refresh-token/
        refresh.strategy.ts
        refresh-auth.guard.ts
      temp-token/
        temp.strategy.ts
        temp-auth.guard.ts
  common/
    constants/
      validation.constants.ts                      # NEW: FIELD_DESCRIPTIONS + REGEX_PATTERNS
    dto/
      api-response.ts                              # CHANGE: interface → class with @ApiProperty
    enums/
      auth-type.enum.ts                            # JWT | REFRESH | TEMP | NONE
      token-purpose.enum.ts                        # OTP_VERIFICATION | PASSWORD_RESET | REGISTRATION | SET_PASSWORD
    filters/
      http-exception.filter.ts                     # CHANGE: add per-type handlers + traceId
    helpers/
      extract-root-domain.ts                       # extractRootDomain(url) → ".domain.tld"
    services/
      cookie.service.ts                            # sets/clears all cookies
      custom-jwt.service.ts                        # primitive JWT sign/verify with per-token secrets

  # Per-module additions (do as part of pilot/migration, not all at once)
  auth/
    swagger/
      auth.swagger.ts                              # AuthSwagger object + AuthSwaggerDecorator
    auth.transform.ts                              # OPTIONAL: extract issueSession mapping
  users/
    users.transform.ts                             # OPTIONAL: strip sensitive fields
```

And **delete** `src/auth/helpers/cookie.helper.ts` (after migrating callers).

---

## Open questions for you

### Part A — Auth/Cookies

1. **Cookie names.** The middleware reads `sid` / `refresh_token` / `temp_sid`. The current helper writes `access_token` / `refresh_token`. **Which set is canonical?** I lean `sid` / `refresh_token` / `temp_sid` since the middleware (which is hard to revert without breaking sessions) already uses them.
2. **Mobile?** Are you planning a mobile client soon? If yes, port `isMobileRequest` early. If not, skip it.
3. **Domain strategy.** Are admin/resident on the same root domain in production? If yes, `extractRootDomain` and a leading-dot domain on the cookie is essential. If they're on different domains, drop the domain logic and rely on per-app cookies.
4. **Refresh-token DB persistence.** app tracks refresh tokens in `app.refresh_tokens` with rotation. A purely-stateless JWT-only approach is also viable. **Keep app's stateful approach** — it's stricter (revocation works, sessions are auditable).
5. **Adoption pace.** Do you want all 7 Part-A steps in one PR (big diff, single review), or staged across multiple PRs (one per step)? I recommend staged.

### Part B — Wider patterns

6. **API envelope camelCase or snake_case?** app uses camelCase across the board. **Recommend camelCase** to stay consistent. Confirm.
7. **TransformInterceptor — keep or remove?** Once we migrate to explicit `*ApiResponse` return types, the auto-wrapping interceptor is either a safety net or dead weight. Recommend keeping (idempotent if already wrapped) during migration; remove at the end.
8. **Swagger pilot module.** Which module to convert first? Recommend `auth` (most endpoints, biggest visual win). Or pick something smaller like `admin/cohorts` (the new module we just shipped) for a low-risk first try.
9. **`APP_STRINGS`?** Are you planning i18n in the next 6 months? If no, skip — keep inline strings. If yes, port it now so messages are centralised before they multiply.
10. **`*Transform` classes — opt-in per module?** Or convention to always have one? Recommend opt-in — only when entity ≠ response and the mapping is non-trivial.

Once you answer 1–10, the actual implementation work follows the file tree above. Pilot one module each from Part A and Part B in a single PR to validate both patterns; then expand.
