# Skill: Admin Best Practices

Review checklist for `apps/web` code. Companion: `.claude/skills/web/SKILL.md`.

## Naming & structure

- kebab-case files/folders, everywhere, no exceptions
- Route-private code in `_components/` / `_libs/` next to its route; app-wide code in `src/components/composites|layouts`, `src/hooks`, `src/app/_libs`
- Named exports; default exports only for `page.tsx`/`layout.tsx`/route files
- Path aliases (`@/…`) for cross-folder imports; relative only within a feature

## TypeScript

- Strict mode; no `any` — `unknown` + narrowing
- `import type { X }` for type-only imports (verbatimModuleSyntax)
- No non-null assertions (`!`) on network data; handle `undefined` explicitly
- Props interfaces named `<Component>Props`; exported only if consumed elsewhere
- Note: `noUnusedLocals`/`noUnusedParameters` are OFF in tsconfig (the generated SDK can't pass them) — `eslint unused-imports` enforces this for app code, so lint must stay green

## Security (admin app = high-privilege surface)

- No secrets client-side, ever: no `ADMIN_API_KEY`, no service tokens, nothing beyond `NEXT_PUBLIC_*` config. Guarded endpoints → server route handler proxy (`api-hooks.md`)
- Tokens are httpOnly and backend-owned; client stores only profile/flag mirrors (`auth.md`)
- All env access via `env.ts`; adding a var means adding it to the schema + `runtimeEnv` + `.env.example`
- UI role-gating is convenience; the backend authorizes every request
- `robots: { index: false }` stays — this app is never indexed

## Data

- `@food/sdk` + React Query only; no fetch-in-component, no server actions, no app database (the drizzle leftovers in `apps/web`'s boilerplate must NOT be replicated here)
- Query keys from factories; mutations invalidate `KEYS.all` + toast
- URL-as-state for lists

## Quality gates

```bash
pnpm type:check   # tsc
pnpm lint         # eslint (errors block; warnings should trend to zero)
pnpm test:run     # vitest
pnpm type:circular # madge — no cycles
```

Note: repo-wide `pnpm lint:check` at the root is broken (missing @nx/eslint-plugin — known issue); use the per-app commands above.

## Review red flags

- `"use client"` on a `page.tsx`
- `useEffect` doing data fetching or derivable computation
- Inline query keys / query keys not from a factory
- New dependency added for something the stack already covers (dates → date-fns, icons → react-icons, variants → CVA)
- Edits inside `src/components/ui/`
- `console.log` (eslint errors on it; use toasts or remove)
- Copy-pasted composite instead of promotion (two near-identical `_components` files across features)
- Missing skeleton/empty/error branch on a data-driven view
