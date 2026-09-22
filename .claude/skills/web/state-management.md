# Skill: State Management

Decision table for where state lives in `apps/web`.

| Kind of state | Where it lives | How |
| ------------- | -------------- | --- |
| Backend data | React Query cache | `useQuery`/`useMutation` + key factories (`api-hooks.md`) |
| List filters / pagination / search | **the URL** | pure parse/build helpers in feature `_libs/` (`data-table.md`). Deliberate choice over `useState` filters (which are lost on refresh) — the URL survives refresh/back/share |
| Text being typed (search box) | local `useState` buffered via `useDebounce`, then patched into the URL | `users-client.tsx` |
| Ephemeral UI (dialog open, selected row) | local `useState` in the client orchestrator | — |
| Session / current admin | `AuthProvider` (`useAuth()`) | localStorage + mirror cookie, `useSyncExternalStore` |
| Cross-feature client state (rare) | React context provider in `src/app/providers/` | add only when two+ features truly share it |

## Rules

- **Default to no state.** Derive during render whenever possible (`const params = parse…(searchParams)` is derived, not stored).
- Never copy React Query data into `useState` — render from `data` directly; transform with `select` or inline derivation.
- Never mirror URL state into `useState` (the debounced search buffer is the single exception).
- No Zustand/Redux/Jotai until a concrete need survives review — context + React Query has covered every admin use case in the reference codebases.
- Server/client boundary: state hooks force `"use client"`; keep that at the orchestrator level, not the page level.
- `useEffect` is for synchronizing with external systems only (subscriptions, timers, imperative DOM). Fetching, derived values, and event responses are not effects.

## Sharing state downward

Pass props. If a feature's component tree gets deep (detail page with tabs), a feature-local context in `_libs/<feature>-context.tsx` is fine — scope it to the feature, don't hoist to global providers.

## Anti-patterns

- `useState` + `useEffect` chains that recompute what render could derive
- Global stores for data React Query already caches
- Prop-drilling avoidance via module-level mutable singletons
- Storing router/searchParams-derived values in state "for performance"
