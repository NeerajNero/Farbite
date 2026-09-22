---
name: backend:module
description: Scaffold a complete NestJS backend module with controller, service, repository, and DTOs
---

# Backend Module Scaffolding

## Trigger

Use when creating a new backend module or domain.

## Steps

1. **Read the spec** — identify entities, relationships, auth requirements, and the full API surface
2. **Write the SQL migration** — create table(s) needed for this module (see `backend:migration`)
3. **Apply migration** — `pnpm db:migrate` → `pnpm db:introspect` to regenerate `schema.ts`
4. **Scaffold the repository** — create `src/db/{module}/{module}.repository.ts` (see `backend:repository`)
5. **Scaffold the DB service** — create `src/db/{module}/{module}.db-service.ts` that wraps the repository (see `backend:db-service`)
6. **Register in db.module.ts** — repository in `providers` only; DB service in both `providers` and `exports`
7. **Create DTOs** — create request/response DTOs in `src/{module}/dto/` (see `backend:dto`)
8. **Scaffold the feature service** — inject DB service, implement business logic (see `backend:service` + `backend:error-handling`)
8. **Scaffold the controller** — create `src/{module}/{module}.controller.ts` with Swagger decorators (see `backend:controller`)
9. **Add route constant** — register path in `src/common/route-names.ts` (never hardcode strings)
10. **Register in `app.module.ts`** — import and add to `imports` (enables routing)
11. **Register in `src/main.ts` `V1_MODULES`** — add to `V1_MODULES` array AND add the import at the top of the file (enables Swagger UI + SDK generation). This is separate from `app.module.ts` — a module missing here will route correctly but be completely invisible in Swagger.
12. **Run `pnpm type-check`** — fix all errors before proceeding
13. **Run `pnpm lint`** — fix all lint warnings
14. **Write unit tests** — co-located `*.spec.ts` for service, controller, strategy (see `backend:test`)
15. **Write integration tests** — `tests/integration/<module>.integration.spec.ts` for all endpoints against real DB/Redis (invoke `backend-integration-test-writer`)
16. **Run `pnpm sdk:generate`** from the repo root (backend must be running) — regenerate the typed client SDK `@food/sdk` at `libs/sdk` so frontend hooks pick up the new endpoints

## File Structure

```
src/{module-name}/
  {module-name}.module.ts
  {module-name}.controller.ts
  {module-name}.service.ts
  dto/
    create-{module-name}.dto.ts
    update-{module-name}.dto.ts
    {module-name}-response.dto.ts
  interfaces/
    {module-name}.interface.ts

src/db/{module-name}/
  {module-name}.repository.ts
  {module-name}.db-service.ts       # DB service wrapper
```

## Templates

### Module

```typescript
import { Module } from '@nestjs/common';
import { {PascalName}Controller } from './{module-name}.controller';
import { {PascalName}Service } from './{module-name}.service';

@Module({
  controllers: [{PascalName}Controller],
  providers: [{PascalName}Service],
  exports: [{PascalName}Service],
})
export class {PascalName}Module {}
```

### Controller

```typescript
import {
  Controller, Get, Post, Body, Param, Patch, Delete,
  HttpCode, HttpStatus, ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiParam,
} from '@nestjs/swagger';
import { RouteNames } from '@common/route-names';
import { ApiEnvelopedResponse } from '@common/decorators/api-enveloped-response.decorator';
import { CurrentUser } from '@auth/decorators/current-user.decorator';
import { {PascalName}Service } from './{module-name}.service';
import { Create{PascalName}Dto } from './dto/create-{module-name}.dto';
import { Update{PascalName}Dto } from './dto/update-{module-name}.dto';
import { {PascalName}ResponseDto } from './dto/{module-name}-response.dto';
import { AuthUser } from '@auth/interfaces/auth-user.interface';

@ApiTags('{PascalName}')
@ApiBearerAuth()
@Controller({ path: RouteNames.{UPPER_NAME}, version: '1' })
export class {PascalName}Controller {
  constructor(private readonly {camelName}Service: {PascalName}Service) {}

  // RULE: Every endpoint must declare a response decorator for ALL possible status codes.
  // Success responses with a body DTO use @ApiEnvelopedResponse (documents the real
  // { statusCode, status, message, data, error } envelope — see backend:swagger Rule 2.2).
  // Error paths (no body DTO) use plain @ApiResponse({ status, description }).
  // Never document only the success path — SDK consumers need full error type information.

  @Post()
  @ApiOperation({ summary: 'Create {name}' })
  @ApiEnvelopedResponse(201, '{PascalName} created', {PascalName}ResponseDto)
  @ApiResponse({ status: 400, description: 'Validation error — missing or malformed fields' })
  @ApiResponse({ status: 401, description: 'Missing or invalid Bearer token' })
  @ApiResponse({ status: 409, description: '{PascalName} already exists' })
  async create(
    @Body() dto: Create{PascalName}Dto,
    @CurrentUser() user: AuthUser,
  ): Promise<{PascalName}ResponseDto> {
    return this.{camelName}Service.create({ ...dto, userId: user.userId });
  }

  @Get()
  @ApiOperation({ summary: 'List {name}s' })
  @ApiEnvelopedResponse(200, 'List of {name}s', {PascalName}ResponseDto, { isArray: true })
  @ApiResponse({ status: 401, description: 'Missing or invalid Bearer token' })
  async findAll() {
    return this.{camelName}Service.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get {name}' })
  @ApiParam({ name: 'id', description: '{PascalName} ID (UUID)' })
  @ApiEnvelopedResponse(200, '{PascalName} found', {PascalName}ResponseDto)
  @ApiResponse({ status: 401, description: 'Missing or invalid Bearer token' })
  @ApiResponse({ status: 404, description: '{PascalName} not found' })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<{PascalName}ResponseDto> {
    return this.{camelName}Service.findById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update {name}' })
  @ApiParam({ name: 'id', description: '{PascalName} ID' })
  @ApiEnvelopedResponse(200, '{PascalName} updated', {PascalName}ResponseDto)
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Missing or invalid Bearer token' })
  @ApiResponse({ status: 404, description: '{PascalName} not found' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: Update{PascalName}Dto,
  ): Promise<{PascalName}ResponseDto> {
    return this.{camelName}Service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete {name}' })
  @ApiParam({ name: 'id', description: '{PascalName} ID' })
  @ApiResponse({ status: 204, description: 'Deleted successfully' })
  @ApiResponse({ status: 401, description: 'Missing or invalid Bearer token' })
  @ApiResponse({ status: 404, description: '{PascalName} not found' })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.{camelName}Service.remove(id);
  }
}
```

### Service

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { {PascalName}DbService } from '@db/{module-name}/{module-name}.db-service';
import { Create{PascalName}Dto } from './dto/create-{module-name}.dto';
import { Update{PascalName}Dto } from './dto/update-{module-name}.dto';

@Injectable()
export class {PascalName}Service {
  constructor(private readonly {camelName}Db: {PascalName}DbService) {}

  async create(dto: Create{PascalName}Dto) {
    return this.{camelName}Db.create(dto);
  }

  async findAll(filters?: { limit?: number; offset?: number }) {
    const [items, total] = await Promise.all([
      this.{camelName}Db.findAll(filters),
      this.{camelName}Db.count(filters),
    ]);
    return { data: items, meta: { total, ...filters } };
  }

  async findById(id: string) {
    const result = await this.{camelName}Db.findById(id);
    if (!result) throw new NotFoundException(`{PascalName} "${id}" not found`);
    return result;
  }

  async update(id: string, dto: Update{PascalName}Dto) {
    await this.findById(id);
    return this.{camelName}Db.update(id, dto);
  }

  async remove(id: string) {
    await this.findById(id);
    await this.{camelName}Db.delete(id);
  }
}
```

## Registration Checklist

- [ ] Add route to `src/common/route-names.ts`
- [ ] Import module in `src/app.module.ts` (routing)
- [ ] Add module to `V1_MODULES` in `src/main.ts` + add its import at the top (Swagger + SDK)
- [ ] Add `.addTag('FeatureName', '...')` to `DocumentBuilder` in `src/main.ts` (appended after existing tags; Auth stays first)
- [ ] Register repository in `src/db/db.module.ts`
- [ ] Every endpoint has a response decorator for every possible status code (success + all error paths) — `@ApiEnvelopedResponse` for success responses with a body DTO, `@ApiResponse` for error paths
- [ ] Every `@ApiBearerAuth()` endpoint includes `@ApiResponse({ status: 401, ... })`
- [ ] Run `pnpm type-check`
- [ ] Write integration tests — `tests/integration/<module>.integration.spec.ts` (invoke `backend-integration-test-writer`; all must pass before SPEC is marked completed)
