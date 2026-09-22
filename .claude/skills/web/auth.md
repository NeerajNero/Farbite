# Skill: Auth

Admin session handling. Backend admin auth is LIVE (SPEC-036, 2026-08): email → OTP → httpOnly JWT cookies.

## Current state (2026-08, SPEC-036/SPEC-ADM-001 shipped)

- Backend admin auth module at `apps/backend/src/api/admin/`:
  `POST /v1/admin/auth/{request-otp,verify-otp,refresh,logout}`, `GET /v1/admin/auth/me`.
  Email OTP (6-digit, Redis `admin:otp:*`, 5-min expiry, 60-s resend cooldown,
  5 attempts → 15-min lock, `IS_OTP_BYPASS` → `123456` non-prod), then a stateless
  admin-scoped JWT pair (`ADMIN_JWT_SECRET`/`ADMIN_JWT_REFRESH_SECRET`, 15m/7d,
  payload `type: 'admin_access' | 'admin_refresh'`). Revocation via
  `admin_user.sessions_invalidated_at` (logout kills all tokens for that admin).
- Admin identities come from the seeded `admin_user` table (`admin_role_enum`:
  `super_admin | support_agent | moderator | data_analyst`). OTP is only emailed to
  active rows; request-otp is anti-enumeration (identical 200 for unknown emails).
- Backend guarding: `@AdminAuth(...roles)` composed decorator
  (`apps/backend/src/api/admin/auth/decorators/admin-auth.decorator.ts`) =
  `@Public()` + `AdminJwtGuard` (`'admin-jwt'` strategy, cookie-or-Bearer) +
  `AdminRolesGuard`. Use it for every new admin endpoint — never hand-write the
  `@Public()`/`@UseGuards` pair. `@CurrentAdmin()` injects `AuthAdmin`.
- `AdminApiKeyGuard` (static `X-Admin-Api-Key`) is legacy — still on
  `GET /v1/admin/subscriptions/metrics` and `POST /v1/notifications/send`;
  migrate those to `@AdminAuth()` when touched.
- Dev mode still exists: `NEXT_PUBLIC_ADMIN_AUTH_MODE=dev` makes the login form
  create a local session without a backend call (offline UI work).

## The pieces (admin app)

| File | Role |
| ---- | ---- |
| `src/proxy.ts` | Edge gate: verifies the access JWT with `jose.jwtVerify` against server-only `ADMIN_JWT_SECRET` (`type === 'admin_access'`). Expired/invalid access + refresh cookie present → allowed through (apiFetch silently refreshes). Dev-mode falls back to the mirror cookie. |
| `src/app/_libs/constants/auth.ts` | Cookie names + `AdminRole` type |
| `src/app/_libs/auth/session-store.ts` | Framework-free client session store: profile in localStorage + mirror cookie; `clearLocalSessionAndRedirect()` for hard 401 teardown |
| `src/app/providers/auth-provider.tsx` | `useAuth()`: reads session-store; `logout()` = best-effort backend logout then local clear |
| `src/app/_libs/api/client.ts` | `apiFetch`: on 401 (non-auth paths, backend mode) → single-flight `POST /v1/admin/auth/refresh` (plain fetch) → one retry → else session teardown |
| `src/app/(auth)/login/` | Two-step form: email → `api.admin.adminAuthRequestOtp` → OTP step (`InputOTP`, 60-s resend countdown) → `api.admin.adminAuthVerifyOtp` → `login(data.admin)` |

## Cookie model

- **Real tokens** (`food_admin_access_token`, `food_admin_refresh_token`): httpOnly,
  SameSite=Lax, secure in prod, set/cleared ONLY by the backend
  (`admin-cookie.util.ts`). Forwarded automatically (`credentials: "include"`).
  Tokens never appear in response bodies or JS-readable state.
- **Mirror cookie** (`food_admin_session=1`): non-httpOnly, client-set, dev-mode
  only as an auth signal. A UX hint, not a security boundary.

## Env contract

- Backend: `ADMIN_JWT_SECRET` + `ADMIN_JWT_REFRESH_SECRET` (required, boot-fails
  if missing), `ADMIN_JWT_ACCESS_EXPIRY=15m`, `ADMIN_JWT_REFRESH_EXPIRY=7d`,
  `ADMIN_COOKIE_DOMAIN` (prod), `CORS_ORIGINS` must include the admin origin.
- Admin app: `ADMIN_JWT_SECRET` (server-only, SAME value as backend — needed by
  proxy.ts), `NEXT_PUBLIC_ADMIN_AUTH_MODE=backend`.

## Rules

- Never store tokens in localStorage or non-httpOnly cookies — only the profile/flag mirror.
- Role checks in the UI (hiding nav items, disabling buttons) are convenience only; every privileged action must be enforced by the backend.
- All auth-related constants come from `constants/auth.ts` — no string literals.
- New admin-JWT-guarded endpoints are callable directly from the browser via the SDK — do NOT create `src/app/api/` proxy route handlers for them (those are only for legacy `ADMIN_API_KEY` endpoints).
