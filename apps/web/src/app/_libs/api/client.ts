import 'server-only';
import { serverEnv } from '@/env';

// The ONLY place browser-bound identity headers for the NestJS API are built
// (PLAN.md §7.2). Server-side only: route handlers, server components, server
// actions. Phase 2 wires the Auth.js session into the actor headers.

const API_TIMEOUT_MS = 30_000; // Render free tier cold start can take ~1 min; we time out at 30 s and show "waking up" UI (Phase 3).

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

/** True when the API is likely cold-starting (timeout / connection refused). */
export function isApiWakingUp(err: unknown): boolean {
  return (
    (err instanceof Error && err.name === 'TimeoutError') ||
    (err instanceof TypeError && 'cause' in err)
  );
}

interface Session {
  userId: string;
  email: string;
}

interface ApiFetchOptions extends Omit<RequestInit, 'headers'> {
  /** Phase 2: pass the Auth.js session to act as a signed-in user. */
  session?: Session;
  /** Forwarded to the API as X-Client-IP for rate limiting. */
  clientIp?: string;
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { session, clientIp, ...init } = options;

  const headers = new Headers({
    'Content-Type': 'application/json',
    'X-Internal-Key': serverEnv.INTERNAL_API_KEY,
    'X-Actor-Type': session ? 'user' : 'guest',
  });
  if (session) {
    headers.set('X-User-Id', session.userId);
    headers.set('X-User-Email', session.email);
  }
  if (clientIp) headers.set('X-Client-IP', clientIp);

  const res = await fetch(`${serverEnv.API_BASE_URL}${path}`, {
    ...init,
    headers,
    signal: AbortSignal.timeout(API_TIMEOUT_MS),
    cache: 'no-store',
  });

  const body: unknown = await res.json().catch(() => null);

  if (!res.ok) {
    const error =
      typeof body === 'object' && body !== null && 'error' in body
        ? (body as { error: { code?: string; message?: string; details?: unknown } }).error
        : {};
    throw new ApiError(
      res.status,
      error.code ?? 'INTERNAL',
      error.message ?? `API request failed (${res.status})`,
      error.details,
    );
  }

  return body as T;
}
