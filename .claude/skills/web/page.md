# Skill: Page

App Router pages in `src/app/(app)/<feature>/`.

## The split — server page + client orchestrator

`page.tsx` is ALWAYS a thin server component. It owns metadata, Suspense, and the skeleton. All interactivity, data fetching, and URL-state handling live in a `"use client"` orchestrator in `_components/`.

```tsx
// src/app/(app)/<feature>/page.tsx
import type { Metadata } from "next";
import { Suspense } from "react";

import { DataTableSkeleton } from "@/components/composites/data-table-skeleton";
import { PageHeader } from "@/components/composites/page-header";

import { FeatureClient } from "./_components/feature-client";

export const metadata: Metadata = {
  title: "Feature", // becomes "Feature | Food Admin" via the root template
};

export default function FeaturePage() {
  return (
    <div>
      <PageHeader title="Feature" description="One-line purpose" />
      <Suspense fallback={<DataTableSkeleton columns={4} />}>
        <FeatureClient />
      </Suspense>
    </div>
  );
}
```

Why Suspense is mandatory: the client orchestrator calls `useSearchParams()`, which requires a Suspense boundary for static rendering — builds fail without it.

## Feature folder anatomy

```
src/app/(app)/<feature>/
├── page.tsx                          # server: metadata + Suspense + skeleton
├── _components/
│   ├── <feature>-client.tsx          # client orchestrator
│   ├── <feature>-table.tsx           # feature-scoped pieces as needed
│   └── <feature>-form.tsx
├── _libs/
│   └── <feature>-search-params.ts    # pure URL-state helpers (see data-table.md)
└── [id]/
    └── page.tsx                      # detail page (same server/client split)
```

## Detail pages

`[id]/page.tsx` receives `params` as a Promise in Next 16:

```tsx
export default async function FeatureDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <FeatureDetailClient id={id} />
    </Suspense>
  );
}
```

## Route-level loading

Every feature route also ships a `loading.tsx` skeleton (instant feedback during route transitions, complementing the in-page Suspense fallback):

```tsx
// src/app/(app)/<feature>/loading.tsx
export default function FeatureLoading() {
  return (
    <div>
      <Skeleton className="mb-6 h-8 w-40" />
      <DataTableSkeleton columns={4} />
    </div>
  );
}
```

## Breadcrumbs

The `(app)/layout.tsx` header derives breadcrumbs from the pathname automatically (id-like segments render as "Details"). Detail pages should override them with the entity's name:

```tsx
import { usePageBreadcrumbs } from "@/app/(app)/_libs/breadcrumb-context";

usePageBreadcrumbs(user ? [
  { label: "Users", href: "/users" },
  { label: user.name },
] : null);
```

## Detail pages with tabs

Tabbed detail pages keep each panel in `_components/_tab/<tab-name>-tab.tsx`, orchestrated by the detail client with the shadcn `Tabs` primitive.

## Checklist for a new page

1. Create the feature folder under `(app)/` with `page.tsx` + `loading.tsx` + `_components/` + `_libs/`
2. Add the route to `ADMIN_ROUTES` in `src/app/_libs/constants/routes.ts`
3. Add a `NAV_GROUPS` entry in `src/app/(app)/layout.tsx` (pick the right group or create one)
4. Export `metadata` from `page.tsx`
5. List pages follow `data-table.md`; forms follow `form.md`
6. Detail pages override breadcrumbs via `usePageBreadcrumbs`
7. Reference implementation: `src/app/(app)/users/`

## Anti-patterns

- `"use client"` on `page.tsx`
- Data fetching in the server page (backend data comes through React Query on the client — see `api-hooks.md`)
- Skipping the Suspense boundary around anything using `useSearchParams`
- Hardcoding hrefs instead of `ADMIN_ROUTES`
