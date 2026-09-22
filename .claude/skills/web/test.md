# Skill: Test

Vitest + Testing Library (jsdom). Config: `./vitest.config.ts`; setup: `src/test/setup.ts` (jest-dom matchers). Run: `pnpm test:run`.

## What to test (priority order)

1. **Pure helpers** — search-param parse/build, formatters, feature `_libs/` utilities. Cheap, high-value. Example: `src/test/users-search-params.test.ts` (defaults, round-trip, omission of defaults, invalid-input clamping).
2. **Composites with logic** — `DataTable` empty state, `TablePagination` boundary disabling, `StatusBadge` variants.
3. **Forms** — validation messages appear, submit calls the mutation with parsed values.
4. **Client orchestrators** — only the tricky ones; wrap in a fresh `QueryClientProvider` and mock the `api` module.

Skip: ui primitives (vendored), thin server pages, styling.

## Conventions

- Tests live in `src/test/`, named `<subject>.test.ts(x)`
- `describe` per module, `it` sentences state behavior ("omits default values from the href")
- Component tests use Testing Library queries by role/label — no `container.querySelector`

## Component test template

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

vi.mock("@/app/_libs/api/client", () => ({
  api: { users: { list: vi.fn().mockResolvedValue({ items: [], pagination: { totalItems: 0 } }) } },
}));

describe("FeatureClient", () => {
  it("shows the empty state when the list is empty", async () => {
    renderWithQuery(<FeatureClient />);
    expect(await screen.findByText(/no .* found/i)).toBeInTheDocument();
  });
});
```

Mocking Next router in component tests:

```tsx
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/users",
}));
```

## Definition of done

Every new feature ships with at least its `_libs/` helpers tested. `pnpm test:run` green is part of the quality gate — a feature is not complete with failing or missing tests.
