---
name: backend:db-service
description: Create the DB service layer that wraps a repository and exposes a clean data-access API to feature services
---

# Backend DB Service

## Trigger

Use when creating a new domain under `src/db/{module-name}/`. A DB service always accompanies its repository — they live side-by-side and are the only entry point to that domain's data.

## Architecture

```
Controller (HTTP)
    ↓
Feature Service  (business logic — src/api/{module}/{module}.service.ts)
    ↓
DB Service       (data access API — src/db/{module-name}/{module-name}.db-service.ts)  ← THIS FILE
    ↓
Repository       (Drizzle queries — src/db/{module-name}/{module-name}.repository.ts)  PRIVATE
```

- **DB Service** — PUBLIC, exported from `DBModule`, injected into feature services
- **Repository** — PRIVATE, only imported by its own DB service; never by feature services or controllers

## Steps

1. **Confirm the repository exists** at `src/db/{module-name}/{module-name}.repository.ts` (see `backend:repository`)
2. **Create the DB service file** at `src/db/{module-name}/{module-name}.db-service.ts`
3. **Inject the repository** in the constructor — this is the ONLY file allowed to import the repository
4. **Expose clean, domain-scoped methods** — wrap repository calls; add no business logic (no exceptions, no role checks)
5. **Register both** repository and DB service in `src/db/db.module.ts` — repository in `providers` only; DB service in both `providers` and `exports`
6. **Inject DB service into feature service** — feature service imports DB service via `@db/{domain}/{module-name}.db-service` path alias
7. **Run `pnpm type-check`** — fix all errors

## Template

```typescript
// src/db/{module-name}/{module-name}.db-service.ts
import { Injectable } from '@nestjs/common';
import {
  {PascalName}Repository,
  {PascalName}Filters,
} from './{module-name}.repository';
import { Create{PascalName}Dto } from '@{module}/dto/create-{module}.dto';
import { Update{PascalName}Dto } from '@{module}/dto/update-{module}.dto';

@Injectable()
export class {PascalName}DbService {
  constructor(
    private readonly {camelName}Repo: {PascalName}Repository,
  ) {}

  async create(data: Create{PascalName}Dto) {
    return this.{camelName}Repo.create(data);
  }

  async findAll(filters?: {PascalName}Filters) {
    return this.{camelName}Repo.findAll(filters);
  }

  async findById(id: string) {
    return this.{camelName}Repo.findById(id);
  }

  async findByUserId(userId: string) {
    return this.{camelName}Repo.findByUserId(userId);
  }

  async update(id: string, data: Update{PascalName}Dto) {
    return this.{camelName}Repo.update(id, data);
  }

  async delete(id: string) {
    return this.{camelName}Repo.delete(id);
  }

  async count(filters?: Pick<{PascalName}Filters, 'search' | 'status' | 'userId'>) {
    return this.{camelName}Repo.count(filters);
  }

  async exists(id: string): Promise<boolean> {
    return this.{camelName}Repo.exists(id);
  }
}
```

## Registration in `db.module.ts`

```typescript
// src/db/db.module.ts
import { {PascalName}Repository } from './{domain}/{module-name}.repository';
import { {PascalName}DbService } from './{domain}/{module-name}.db-service';

@Global()
@Module({
  providers: [
    DBService,
    {PascalName}Repository,   // PRIVATE — not in exports
    {PascalName}DbService,    // PUBLIC — exported
  ],
  exports: [
    DBService,
    {PascalName}DbService,    // Feature services import this, never the repository
  ],
})
export class DBModule {}
```

## Consuming in a Feature Service

```typescript
// src/api/{module}/{module}.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { {PascalName}DbService } from '@db/{domain}/{module-name}.db-service';

@Injectable()
export class {PascalName}Service {
  constructor(
    private readonly {camelName}Db: {PascalName}DbService,  // ← DB service, NOT repository
  ) {}

  async findById(id: string) {
    const item = await this.{camelName}Db.findById(id);
    if (!item) throw new NotFoundException(`{PascalName} "${id}" not found`);
    return item;
  }
}
```

## Conventions

- DB service file lives at `src/db/{module-name}/{module-name}.db-service.ts` — **next to** its repository
- Repository is **PRIVATE** — only imported by its DB service, never by feature services or controllers
- DB service contains **no business logic** — no NestJS exceptions, no role checks, no validation
- Export DB service from `DBModule`, never the repository
- Feature services import via path alias: `@db/{domain}/{module-name}.db-service`
- Related: `backend:repository` (creates the repository this wraps), `backend:service` (consumes this)
