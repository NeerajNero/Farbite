---
name: backend:pagination
description: Implement paginated list endpoints using the shared getPaginationDetails helper + PaginatedResponseDto factory and the standard { items, pagination } response shape (icobs-aligned)
---

# Backend Pagination

## Trigger

Use whenever an **offset-paginated** list endpoint returns more than one record.
Every such endpoint must return the shared `{ items, pagination }` shape.

> **Not this pattern:** the swipe/batch **feed** (`FeedResponseDto` — `has_more`,
> `batch_id`, `consumed_count`) is a cursor/batch model, not offset pagination.
> Leave it as-is; it has no `page`/`totalCount`.

## Response shape (the single convention — icobs-aligned)

Inside the global `TransformInterceptor` envelope (`{ statusCode, status, message, data, error }`),
a paginated list's `data` is:

```json
{
  "items": [ ... ],
  "pagination": { "pageNo": 1, "pageSize": 10, "totalCount": 37, "totalPages": 4 }
}
```

- `pageNo`/`pageSize` echo the request; `totalCount` = total matching rows across all
  pages; `totalPages` = `ceil(totalCount / pageSize)`.
- **No `has_more`/`hasNextPage`** — clients derive `pageNo < totalPages`.
- Pagination fields are **camelCase** (`pageNo`/`pageSize`/`totalCount`/`totalPages`);
  item fields keep their own casing.

## Shared building blocks (single source of truth — never reinvent)

- **`getPaginationDetails(totalCount, { pageNo, pageSize })`** → `{ pageNo, pageSize,
  totalCount, totalPages }`, from `@common/pagination/pagination.util`. Never build the
  pagination object by hand.
- **`PaginatedResponseDto(ItemDto)`** + **`PaginationDetailsDto`**, from
  `@common/pagination/pagination.dto`. The factory returns a concrete `{ items, pagination }`
  class per item type (Swagger can't reflect a generic `PaginatedResponseDto<T>`).

## Steps

1. **Request DTO** — `page` + `limit` (+ optional `search`) with class-validator + defaults.
2. **Repository** — `LIMIT :limit OFFSET (page - 1) * limit`, and count via a **separate
   `COUNT(*)` query** with the same filter (see the count rule below).
3. **Feature service** — `getPaginationDetails(total, { pageNo: page, pageSize: limit })`;
   return `{ items, pagination }`.
4. **Response DTO** — `export class {Name}ListResponseDto extends PaginatedResponseDto({Name}ItemDto) {}`.
5. **Controller** — `@ApiEnvelopedResponse(200, '...', {Name}ListResponseDto)`.

## Request query DTO

```typescript
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class PaginationQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit: number = 20; // cap per endpoint with @Max(...) where a hard ceiling applies

  @ApiPropertyOptional({ description: 'Name search' })
  @IsOptional()
  @Transform(({ value }): unknown => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(60)
  search?: string;
}
```

## Repository (LIMIT/OFFSET + a SEPARATE count query)

```typescript
async list{Name}(
  userId: string,
  { page, limit, search }: List{Name}Params
): Promise<{ rows: {Name}Row[]; total: number }> {
  const offset = (page - 1) * limit;
  const searchFilter =
    search && search.length > 0
      ? sql`AND (COALESCE(u.display_name,'') || ' ' || u.first_name || ' ' || u.last_name) ILIKE ${`%${search}%`}`
      : sql``;

  const result = await this.db.execute(sql`
    SELECT ... FROM ... u WHERE ... ${searchFilter}
    ORDER BY ... LIMIT ${limit} OFFSET ${offset}
  `);

  // Count via a SEPARATE query with the identical filter. Do NOT use
  // `COUNT(*) OVER()` on the data query — it rides on the returned rows and is
  // LOST when a past-the-end page returns zero rows, collapsing total to 0.
  const countResult = await this.db.execute(sql`
    SELECT COUNT(*)::int AS total FROM ... u WHERE ... ${searchFilter}
  `);
  const total = Number((countResult.rows as Record<string, unknown>[])[0]?.['total'] ?? 0);

  return { rows: (result.rows as Record<string, unknown>[]).map(r => mapRow(r)), total };
}
```

## Feature service

```typescript
import { getPaginationDetails } from '@common/pagination/pagination.util';

async list(userId: string, query: PaginationQueryDto) {
  const { page, limit } = query;
  const search = query.search && query.search.length > 0 ? query.search : undefined;

  const { rows, total } = await this.{camelName}Db.list{Name}(userId, {
    page,
    limit,
    ...(search !== undefined && { search }),
  });

  return {
    items: rows.map(r => this.toItemDto(r)),
    pagination: getPaginationDetails(total, { pageNo: page, pageSize: limit }),
  };
}
```

## Response DTO

```typescript
import { PaginatedResponseDto } from '@common/pagination/pagination.dto';
import { {Name}ItemDto } from './{name}-item.dto';

// Concrete class so Swagger / the SDK get a real schema.
export class {Name}ListResponseDto extends PaginatedResponseDto({Name}ItemDto) {}
```

## Controller

```typescript
@Get()
@ApiOperation({ summary: 'List {name}s' })
@ApiEnvelopedResponse(200, 'Paginated {name}s', {Name}ListResponseDto)
async list(@Query() query: PaginationQueryDto, @CurrentUser() user: AuthUser) {
  return this.{camelName}Service.list(user.userId, query);
}
```

`ApiEnvelopedResponse` is imported from `@common/decorators/api-enveloped-response.decorator` — see `backend:swagger` Rule 2.2.

## Conventions

- Always use **`getPaginationDetails`** for the `pagination` block — never hand-build it.
- Always **`extends PaginatedResponseDto(ItemDto)`** for the list response DTO — never
  re-declare `items`/`pagination` inline.
- **Count via a SEPARATE query** — never `COUNT(*) OVER()` (empty/past-end page loses the total).
- Request params are `page`/`limit`; the helper maps them to `pageNo`/`pageSize` in the response.
- Response is `{ items, pagination }` with camelCase pagination fields (matches the icobs reference).
- Page-past-the-end returns `items: []` with the correct `totalCount`/`totalPages` — **never a 404**.
- The swipe **feed** (`has_more`/`batch_id`) is a batch cursor, NOT this pattern.
- See `backend:dto` (List Response DTO), `backend:swagger` (Rule 2.3), `backend:repository`.
