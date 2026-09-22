---
name: mobile-firebase
description: >
  Use this skill for any task involving Firebase in the React Native Expo mobile app —
  Crashlytics crash reporting, Performance Monitoring traces, error boundary wiring,
  user identity, screen-level instrumentation, or adding new Firebase services.
  Triggers: "firebase", "crashlytics", "crash reporting", "performance trace",
  "screen trace", "firebase perf", "rnf", "recordError", "useScreenTrace".
---

# Firebase Integration Skill — food Mobile App

## Project Context

| Item | Value |
|---|---|
| App | `apps/mobile-app` |
| Firebase packages | `@react-native-firebase/app`, `@react-native-firebase/crashlytics`, `@react-native-firebase/perf` (v21) |
| Service layer | `./services/firebase/` |
| Crashlytics wrapper | `services/firebase/crashlytics.ts` → `Crashlytics` |
| Performance wrapper | `services/firebase/performance.ts` → `Performance` |
| Barrel | `services/firebase/index.ts` |
| Screen trace hook | `hooks/useScreenTrace.ts` |
| Persist store | `store/usePersistStore.ts` (login/logout set Crashlytics userId) |
| Error boundary | `components/ErrorBoundaryCore.tsx` calls `Crashlytics.recordError()` |
| Global handler | `app/_layout.tsx` — `ErrorUtils.setGlobalHandler` + app launch trace |

---

## Rule 1 — Never import RNF directly in components or screens

All Firebase access goes through the service wrappers. Components and screens import from
`@/services/firebase`, never from `@react-native-firebase/*` directly.

```typescript
// ✅ correct
import { Crashlytics, Performance } from '@/services/firebase';

// ❌ never do this in a component
import crashlytics from '@react-native-firebase/crashlytics';
```

---

## Rule 2 — Crashlytics wrapper (`services/firebase/crashlytics.ts`)

All methods are wrapped in a `safe()` try/catch so they silently no-op in Expo Go or tests.

```typescript
export const Crashlytics = {
  setUserId: (userId: string) => ...
  setAttribute: (key: string, value: string) => ...
  setAttributes: (attrs: Record<string, string>) => ...
  log: (message: string) => ...                        // breadcrumb
  recordError: (error: Error, context?: string) => ...  // non-fatal
  testCrash: () => ...                                  // __DEV__ only
};
```

When to call each:
- `setUserId` — after login in `usePersistStore.login()` (already wired)
- `setUserId('')` — after logout in `usePersistStore.logout()` (already wired)
- `recordError` — in error boundaries, catch blocks for non-fatal events
- `log` — breadcrumbs before risky operations (navigation, API calls)
- `setAttribute` / `setAttributes` — app_env, feature flags, onboarding step

---

## Rule 3 — Performance wrapper (`services/firebase/performance.ts`)

```typescript
export const Performance = {
  startTrace: async (name: string): Promise<Trace | null> => ...
  newHttpMetric: (url, method): HttpMetric | null => ...
};
```

Trace names must be lowercase with underscores only: `screen_home_feed`, `food_app_launch`.

---

## Rule 4 — Screen traces via `useScreenTrace`

```typescript
import { useScreenTrace } from '@/hooks/useScreenTrace';

export default function SomeScreen() {
  const trace = useScreenTrace('screen_some_name');
  // trace auto-starts on mount, auto-stops on unmount

  // Optional: add custom metrics after data loads
  useEffect(() => {
    if (data) trace.putMetric('items_loaded', data.length);
  }, [data]);
}
```

Priority screens that MUST have traces:
| Screen | Trace name |
|---|---|
| `app/(tabs)/index.tsx` | `screen_home_feed` |
| `app/(tabs)/matches.tsx` | `screen_matches` |
| `app/(interview)/interview.tsx` | `screen_interview` |
| `app/(interview)/building-profile.tsx` | `screen_building_profile` |

---

## Rule 5 — User identity wiring

`usePersistStore` (`store/usePersistStore.ts`) already handles this:

```typescript
login: (accessToken, refreshToken, user) => {
  if (user) {
    Crashlytics.setUserId(user.userId);
    Crashlytics.setAttributes({ app_env: process.env.APP_ENV ?? 'development' });
  }
  set({ isLoggedIn: true, accessToken, refreshToken, user });
},
logout: () => {
  Crashlytics.setUserId('');
  set({ isLoggedIn: false, ..., pendingLocation: null });
},
```

Do NOT set `setUserId` anywhere else — the store is the single place.

---

## Rule 6 — Error boundary wiring

`components/ErrorBoundaryCore.tsx` calls `Crashlytics.recordError()` in `handleError`.
`components/PageErrorBoundary.tsx` defers to `ErrorBoundaryCore` — no direct Firebase calls there.

When adding a new error boundary, extend `ErrorBoundaryCore`, don't create a new boundary
pattern from scratch.

---

## Rule 7 — Global handler + app launch trace (in `_layout.tsx`)

```typescript
// Module-level (before any component) in app/_layout.tsx:
let _appLaunchTrace: Trace | null = null;
perf().startTrace('food_app_launch').then(t => { _appLaunchTrace = t; }).catch(() => {});

const defaultHandler = ErrorUtils.getGlobalHandler();
ErrorUtils.setGlobalHandler((error, isFatal) => {
  Crashlytics.log(`[${isFatal ? 'FATAL' : 'ERROR'}] ${error.message}`);
  Crashlytics.recordError(error, isFatal ? 'fatal_uncaught' : 'uncaught_js');
  defaultHandler(error, isFatal);
});

// Stop the trace when splash screen hides:
SplashScreen.hideAsync().then(() => {
  _appLaunchTrace?.stop();
  _appLaunchTrace = null;
});
```

Do NOT add another global error handler — there is only one.

---

## Adding a New Firebase Service

To add a new RNF package (e.g. `@react-native-firebase/messaging`):

1. Install: `pnpm add @react-native-firebase/messaging` in `apps/mobile-app`
2. Add config plugin to `app.config.ts` (after existing RNF plugins)
3. Create `services/firebase/messaging.ts` with a safe-wrapped export object
4. Re-export from `services/firebase/index.ts`
5. Rebuild native: `npx expo prebuild --clean` then `eas build --profile development`

Never call the RNF module directly — always wrap it.

---

## Environment Variables

```bash
# .env (not committed — use .env.example as template)
FIREBASE_PROJECT_ID=food-dev
FIREBASE_APP_ID_ANDROID=1:xxx:android:xxx
FIREBASE_APP_ID_IOS=1:xxx:ios:xxx
```

Config files:
- `android/app/google-services.json` — git-ignored for prod, use EAS Secrets
- `ios/GoogleService-Info.plist` — git-ignored for prod, use EAS Secrets

---

## Testing Firebase Features

- Crashlytics requires a **real device** — simulators do not send reports
- Performance traces take up to 12 hours to appear in Firebase Console (use DebugView for immediate feedback)
- `Crashlytics.testCrash()` is for `__DEV__` builds only
- Non-fatal errors from `recordError()` appear under "Non-fatals" in Firebase Console

---

## Anti-Patterns

```
❌ import crashlytics from '@react-native-firebase/crashlytics' — in components/screens
❌ Calling Crashlytics.setUserId() outside usePersistStore.login/logout
❌ Starting a trace without a corresponding stop (useScreenTrace handles this)
❌ Using a trace name with spaces, dashes, or uppercase letters
❌ Calling firebase.initializeApp() manually — config plugin handles init
❌ Committing production google-services.json — use EAS Secrets
❌ Creating a new global error handler — only one exists in _layout.tsx
❌ Adding Crashlytics calls directly in PageErrorBoundary — use ErrorBoundaryCore
```
