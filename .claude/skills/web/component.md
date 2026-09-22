# Skill: Component

Where components live and how they're built in `apps/web`.

## The three tiers

| Tier | Location | Rule |
| ---- | -------- | ---- |
| ui primitives | `src/components/ui/` | shadcn/ui generated (new-york style). **Never hand-edit.** Add new primitives via `npx shadcn add <name>` semantics — match existing file style exactly |
| Composites | `src/components/composites/` | Cross-feature building blocks composed FROM primitives: `data-table`, `data-table-toolbar`, `data-table-skeleton`, `table-pagination`, `page-header`, `stat-card`, `status-badge`, `empty-state`, `user-info-cell`, `confirm-dialog`, `password-input`, `theme-toggle` |
| Feature components | `src/app/(app)/<feature>/_components/` | Feature-scoped. Start here; promote to composites only when a SECOND feature needs it |

The portal shell (grouped sidebar + breadcrumb header) lives directly in `src/app/(app)/layout.tsx`. When a new cross-feature block is needed (date-range-picker, reason-dialog, stepper, initials-avatar…), build it in `composites/` following the conventions of the existing kit (CVA variants, `className` pass-through, matching skeleton).

## Composite template (CVA variants)

```tsx
// src/components/composites/status-badge.tsx — real example
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/app/_libs/utils/cn";

const statusBadgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        success: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
        destructive: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
        neutral: "bg-muted text-muted-foreground",
      },
    },
    defaultVariants: { variant: "neutral" },
  },
);

interface StatusBadgeProps extends VariantProps<typeof statusBadgeVariants> {
  children: React.ReactNode;
  className?: string;
}

export function StatusBadge({ variant, children, className }: StatusBadgeProps) {
  return <span className={cn(statusBadgeVariants({ variant }), className)}>{children}</span>;
}
```

## Rules

- **kebab-case filenames**, named exports (no default exports outside `page.tsx`/`layout.tsx`)
- Props interface named `<Component>Props`, defined above the component in the same file
- Server components by default; add `"use client"` only when the component uses hooks, events, or browser APIs
- Class merging always via `cn` from `@/app/_libs/utils/cn`; variants via CVA — never string-concatenate classes
- Composites accept `className` and forward it through `cn(...)` so callers can adjust spacing
- Icons: `react-icons` (`FiX` family used in the sidebar); size with Tailwind (`className="size-4"`)
- Skeletons: every composite that displays async data ships a matching skeleton (see `data-table-skeleton.tsx`, `StatCard`'s `isLoading` prop)

## Promotion checklist (feature → composite)

1. A second feature genuinely needs it (not "might need")
2. Strip feature-specific naming and types (generic `<T>` where sensible — see `DataTable<T>`)
3. Move to `src/components/composites/`, update imports in the original feature
4. Keep the composite presentational: data fetching stays in the feature's client orchestrator

## Anti-patterns

- Editing `src/components/ui/*` (wrap or extend in a composite instead)
- Default exports for non-route components
- `React.FC` — type props directly
- Fetching data inside composites
- Inline `style` attributes or hex colors (see `styling.md`)
