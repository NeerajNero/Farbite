---
name: backend:repository
description: Create Drizzle repository in centralized location with proper query patterns
---

# Backend Repository

## Trigger

Use when creating or modifying repositories in `src/db/{module-name}/`.

## Steps

1. **Confirm schema is up to date** — run `pnpm db:introspect` if migrations were recently applied
2. **Create the file** — `src/db/{module-name}/{module-name}.repository.ts` (always in `src/db/`, never inside the feature module)
3. **Import the table** — import the Drizzle table from `@db/drizzle/schema`
4. **Define the Filters interface** — typed filter/pagination options the service will pass in
5. **Implement CRUD methods** — use Drizzle query builder (`eq`, `and`, `like`, `desc`, etc.), never raw SQL here
6. **Register in db.module.ts** — add to `providers` ONLY in `src/db/db.module.ts`. The repository is PRIVATE — never add it to `exports`; only its DB service is exported (see `backend:db-service`)
7. **Inject into the DB service** — add to the DB service constructor (see `backend:db-service`); feature services never inject the repository
8. **Run `pnpm type-check`** — fix all errors

## Location

All repositories MUST be in `src/db/{module-name}/{module-name}.repository.ts`

## Template

```typescript
// src/db/{module-name}/{module-name}.repository.ts
import { Injectable } from '@nestjs/common';
import { eq, and, desc, asc, like, sql, or } from 'drizzle-orm';
import { DBService } from '@db/db.service';
import { {tableName} } from '@db/drizzle/schema';

export interface {PascalName}Filters {
  search?: string;
  status?: string;
  userId?: string;
  limit?: number;
  offset?: number;
  orderBy?: 'createdAt' | 'updatedAt' | 'name';
  orderDir?: 'asc' | 'desc';
}

@Injectable()
export class {PascalName}Repository {
  constructor(private readonly dbService: DBService) {}

  async create(data: typeof {tableName}.$inferInsert) {
    const results = await this.dbService.db
      .insert({tableName})
      .values(data)
      .returning();
    return results[0];
  }

  async findAll(filters: {PascalName}Filters = {}) {
    const {
      search,
      status,
      userId,
      limit = 20,
      offset = 0,
      orderBy = 'createdAt',
      orderDir = 'desc',
    } = filters;

    const conditions = [];
    
    if (search) {
      conditions.push(
        or(
          like({tableName}.name, `%${search}%`),
          like({tableName}.description, `%${search}%`),
        ),
      );
    }
    if (status) {
      conditions.push(eq({tableName}.status, status));
    }
    if (userId) {
      conditions.push(eq({tableName}.userId, userId));
    }

    const orderFn = orderDir === 'asc' ? asc : desc;
    const orderColumn = {
      createdAt: {tableName}.createdAt,
      updatedAt: {tableName}.updatedAt,
      name: {tableName}.name,
    }[orderBy] ?? {tableName}.createdAt;

    return this.dbService.db
      .select()
      .from({tableName})
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(orderFn(orderColumn))
      .limit(limit)
      .offset(offset);
  }

  async findById(id: string) {
    const results = await this.dbService.db
      .select()
      .from({tableName})
      .where(eq({tableName}.id, id))
      .limit(1);
    return results[0];
  }

  async findByUserId(userId: string) {
    return this.dbService.db
      .select()
      .from({tableName})
      .where(eq({tableName}.userId, userId))
      .orderBy(desc({tableName}.createdAt));
  }

  async update(id: string, data: Partial<typeof {tableName}.$inferInsert>) {
    const results = await this.dbService.db
      .update({tableName})
      .set({ ...data, updatedAt: new Date() })
      .where(eq({tableName}.id, id))
      .returning();
    return results[0];
  }

  async delete(id: string) {
    return this.dbService.db
      .delete({tableName})
      .where(eq({tableName}.id, id));
  }

  async count(filters: Pick<{PascalName}Filters, 'search' | 'status' | 'userId'> = {}) {
    const { search, status, userId } = filters;
    const conditions = [];
    
    if (search) {
      conditions.push(like({tableName}.name, `%${search}%`));
    }
    if (status) {
      conditions.push(eq({tableName}.status, status));
    }
    if (userId) {
      conditions.push(eq({tableName}.userId, userId));
    }

    const result = await this.dbService.db
      .select({ count: sql<number>`count(*)` })
      .from({tableName})
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    return result[0]?.count ?? 0;
  }

  async exists(id: string): Promise<boolean> {
    const result = await this.dbService.db
      .select({ id: {tableName}.id })
      .from({tableName})
      .where(eq({tableName}.id, id))
      .limit(1);
    return result.length > 0;
  }
}
```

## Registration

Add to `src/db/db.module.ts`:

```typescript
import { {PascalName}Repository } from './{module-name}/{module-name}.repository';

@Global()
@Module({
  providers: [
    DBService,
    // ... other repositories
    {PascalName}Repository,   // PRIVATE — not in exports
  ],
  exports: [
    DBService,
    // Repositories are never exported — only DB services are (see backend:db-service)
  ],
})
export class DBModule {}
```

## Conventions

- Only Drizzle queries in repositories
- Always return `results[0]` for single queries (may be undefined)
- Always update `updatedAt` on modifications
- Use filters interface for flexible querying
- Keep query logic here, business logic in services
