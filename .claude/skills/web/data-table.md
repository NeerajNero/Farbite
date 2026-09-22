# Skill: Data Table (the list-page recipe)

The canonical pattern for every admin list page. Reference implementation: `src/app/(app)/users/`.

## Principle: the URL is the state

Search, filters, page, and pageSize live in the query string — never in `useState` (exception: the text-search input buffers locally through `useDebounce` before patching the URL). This makes lists shareable, back-button-friendly, and refresh-safe.

## 1. Pure search-param helpers (`_libs/<feature>-search-params.ts`)

```ts
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE } from "@/components/composites/table-pagination";

export interface FeatureListParams {
  q: string;
  status: "all" | "active" | "deleted";
  page: number;
  pageSize: number;
}

export function parseFeatureSearchParams(searchParams: URLSearchParams): FeatureListParams {
  const status = searchParams.get("status");
  return {
    q: searchParams.get("q") ?? "",
    status: status === "active" || status === "deleted" ? status : "all",
    page: Math.max(1, Number(searchParams.get("page")) || DEFAULT_PAGE),
    pageSize: Number(searchParams.get("pageSize")) || DEFAULT_PAGE_SIZE,
  };
}

export function buildFeatureHref(params: FeatureListParams): string {
  const searchParams = new URLSearchParams();
  if (params.q) searchParams.set("q", params.q);
  if (params.status !== "all") searchParams.set("status", params.status);
  if (params.page !== DEFAULT_PAGE) searchParams.set("page", String(params.page));
  if (params.pageSize !== DEFAULT_PAGE_SIZE) searchParams.set("pageSize", String(params.pageSize));
  const query = searchParams.toString();
  return query ? `/feature?${query}` : "/feature";
}
```

Rules: defaults are omitted from the href; invalid values fall back to defaults; helpers are pure (unit-test them — see `src/test/users-search-params.test.ts`).

## 2. Client orchestrator

Full working example: `src/app/(app)/users/_components/users-client.tsx`. The skeleton of it:

```tsx
const params = parseFeatureSearchParams(new URLSearchParams(searchParams.toString()));

// text search buffers locally, then patches the URL after a pause
const [searchInput, setSearchInput] = useState(params.q);
const debouncedSearch = useDebounce(searchInput);

const { data, isLoading } = useQuery({
  queryKey: FEATURE_KEYS.list({ ...params }),
  queryFn: () => api.<domain>.<listMethod>(toRequest(params)),
  placeholderData: (previous) => previous,   // keeps old rows visible while refetching
});

const patch = (changes: Partial<FeatureListParams>) => {
  const page = "page" in changes ? (changes.page ?? 1) : 1; // filter changes reset paging
  router.push(buildFeatureHref({ ...params, ...changes, page }) as Route);
};
```

## 3. Render order

```
PageHeader (in page.tsx) → [StatsCardsGrid] → DataTableToolbar → DataTable → TablePagination
```

- Filter bar: `DataTableToolbar` (search input with icon; filter `Select`s as `children`) — never a hand-rolled flex row
- Loading: `DataTableSkeleton` (match column count)
- Empty: pass a specific `emptyMessage` to `DataTable`; standalone empty views (no table) use the `EmptyState` composite with an icon + optional action
- Row actions: `DropdownMenu` in a `cell` renderer + `ConfirmDialog` for destructive ones; row click navigates to the detail page via `onRowClick`
- User columns: render with `UserInfoCell` (avatar + name + email)

## Columns

```tsx
const COLUMNS: DataTableColumn<RowDto>[] = [
  { key: "name", header: "Name" },
  {
    key: "status",
    header: "Status",
    cell: (row) => <StatusBadge variant={row.status === "active" ? "success" : "destructive"}>{row.status}</StatusBadge>,
  },
];
```

Define `COLUMNS` at module scope (or `useMemo` if they close over callbacks).

## Anti-patterns

- Filter/page state in `useState`
- Pushing to the URL on every keystroke (debounce first)
- Fetching in `useEffect` instead of `useQuery`
- Client-side filtering/pagination of full datasets — the backend paginates (`{ items, pagination }` envelope, see backend `pagination.md`)
- Forgetting `placeholderData: (previous) => previous`, which makes the table flash empty on every filter change
