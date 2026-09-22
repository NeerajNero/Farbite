---
name: backend:service
description: Create NestJS feature service with Facade pattern, DB service injection, and proper error handling
---

# Backend Service

## Trigger

Use when creating or modifying services in `./`.

## Steps

1. **Confirm the DB service exists** at `src/db/{domain}/{domain}.db-service.ts` and is exported from `DBModule` (see `backend:db-service`)
2. **Create the feature service file** — `src/api/{module}/{module}.service.ts`
3. **Inject the DB service** via constructor — NEVER import the repository; feature services only talk to DB services
4. **Implement business logic** — validate inputs, orchestrate DB service calls, throw domain exceptions (`NotFoundException`, `ConflictException`, `BadRequestException`)
5. **Never put SQL or Drizzle queries in the feature service** — all data access goes through the DB service
6. **Register the feature service** in the module's `providers` and `exports` arrays
7. **Run `pnpm type-check`** — fix all errors before wiring to the controller

## Template

```typescript
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { {PascalName}DbService, {PascalName}Filters } from '@db/{module-name}/{module-name}.db-service'; // ← DB service, NOT repository (the db-service re-exports the Filters type)
import { Create{PascalName}Dto } from './dto/create-{module-name}.dto';
import { Update{PascalName}Dto } from './dto/update-{module-name}.dto';

@Injectable()
export class {PascalName}Service {
  constructor(
    private readonly {camelName}Db: {PascalName}DbService,  // ← NEVER inject the repository here
  ) {}

  /**
   * Create a new {name}
   */
  async create(dto: Create{PascalName}Dto) {
    // Add business logic validations here
    return this.{camelName}Db.create(dto);
  }

  /**
   * Find all {name}s with optional filters
   */
  async findAll(filters?: {PascalName}Filters) {
    const [items, total] = await Promise.all([
      this.{camelName}Db.findAll(filters),
      this.{camelName}Db.count(filters),
    ]);

    return {
      data: items,
      meta: {
        total,
        limit: filters?.limit ?? 20,
        offset: filters?.offset ?? 0,
      },
    };
  }

  /**
   * Find {name} by ID
   * @throws NotFoundException if not found
   */
  async findById(id: string) {
    const result = await this.{camelName}Db.findById(id);
    if (!result) {
      throw new NotFoundException(`{PascalName} with ID "${id}" not found`);
    }
    return result;
  }

  /**
   * Find {name}s by user ID
   */
  async findByUserId(userId: string) {
    return this.{camelName}Db.findByUserId(userId);
  }

  /**
   * Update {name}
   * @throws NotFoundException if not found
   */
  async update(id: string, dto: Update{PascalName}Dto) {
    await this.findById(id); // Ensure exists
    return this.{camelName}Db.update(id, dto);
  }

  /**
   * Delete {name}
   * @throws NotFoundException if not found
   */
  async remove(id: string) {
    await this.findById(id); // Ensure exists
    await this.{camelName}Db.delete(id);
    return { success: true, message: `{PascalName} deleted successfully` };
  }
}
```

## Service with Provider (External Integration)

```typescript
@Injectable()
export class {PascalName}Service {
  constructor(
    private readonly {camelName}Db: {PascalName}DbService,  // ← DB service, NOT repository
    private readonly {provider}Provider: {Provider}Provider,
  ) {}

  async processWithExternalService(id: string, data: unknown) {
    // 1. Get via the DB service
    const entity = await this.findById(id);
    
    // 2. Call external provider
    const result = await this.{provider}Provider.process(data);
    
    // 3. Persist the result via the DB service
    return this.{camelName}Db.update(id, { externalId: result.id });
  }
}
```

## Conventions

- **Inject the DB service, never the repository** — `import { {PascalName}DbService } from '@db/{domain}/{domain}.db-service'`
- Use Facade pattern to orchestrate multiple DB services and/or providers
- Always throw `NotFoundException` for missing resources, `ConflictException` for duplicates
- Add JSDoc comments for public methods
- No direct Drizzle imports — all data access goes through DB service
- See `backend:db-service` for creating the DB service this depends on
