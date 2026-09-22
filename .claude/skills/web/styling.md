# Skill: Styling

Tailwind v4, CSS-first. There is **no `tailwind.config.js`** — everything lives in `src/app/globals.css`.

## Token system

`globals.css` defines CSS variables under `:root` (light) and `.dark`, mapped into Tailwind via `@theme inline`:

```
--background/--foreground     --card/--card-foreground     --popover/…
--primary/--primary-foreground  --secondary/…  --muted/…  --accent/…
--destructive  --border  --input  --ring  --radius
--sidebar-* (sidebar shell)     --chart-1..5 (recharts)
```

Consume them as semantic utilities: `bg-background`, `text-muted-foreground`, `border-border`, `bg-sidebar`, `text-sidebar-foreground`, `ring-ring`. Dark mode is automatic (`next-themes` toggles the `.dark` class via the `@custom-variant dark`).

## Rules

- **Never hardcode colors** — no hex, no `bg-blue-500` for brand surfaces. Semantic tokens only. (Narrow exception: `StatusBadge`-style semantic tints that define both light and dark shades explicitly.)
- New color needs a token: add `--token` to `:root` AND `.dark`, then `--color-token: var(--token)` inside `@theme inline`, then use `bg-token`.
- Radius via `rounded-sm|md|lg|xl` (derived from `--radius`); don't invent arbitrary radii.
- Fonts: `font-sans` (Geologica) / `font-mono` (Fira Code), wired in `src/app/_config/fonts.ts` → root layout. New fonts follow the same `variable:` pattern.
- Spacing/layout: Tailwind utilities only; no inline `style` and no CSS modules. Sizing icons: `size-4` not `h-4 w-4`.
- Class merging: `cn()` from `@/app/_libs/utils/cn`; conditional classes as `cn("base", condition && "extra")`.
- Prettier sorts classes (`prettier-plugin-tailwindcss`) — don't fight the order.
- Responsive: mobile-first (`sm:`, `lg:`); admin tables get `overflow-x-auto` wrappers (already in `DataTable`).

## Theme toggling

`ThemeProvider` (next-themes) wraps the app in the root layout with `attribute="class"` and system default. A toggle can use `useTheme()` — put it in the sidebar footer if requested.

## Anti-patterns

- `style={{ … }}` attributes
- Hex/rgb values in class names (`bg-[#3b6cf5]`)
- Editing token values inside `src/components/ui/*` primitives
- `dark:` overrides scattered per-component for things a token should own
