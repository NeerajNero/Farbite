---
name: backend:endpoint
description: Add new endpoints to existing controllers with proper decorators
---

# Backend Endpoint Patterns

## Trigger

Use when adding endpoints to existing controllers in `./`.

## Steps

1. **Read the spec** — Identify the HTTP method, route path, request/response shapes, and auth requirements
2. **Check the existing controller** — Read the target controller file to understand current endpoints and naming patterns
3. **Choose the pattern** — Match your need to the templates below:
   - State change on a resource → Action Endpoint
   - Free-text lofoodp → Search Endpoint
   - Binary data → File Upload
   - Sub-resources (e.g., order items) → Nested Resource
   - Bulk create/update/delete → Batch Operations
   - Single-field state change → Status Update
   - Soft delete / undo → Archive
4. **Create or update DTOs** — Define request/response DTOs before writing the endpoint (see `backend:dto` skill)
5. **Add the service method** — Implement the corresponding method in the service layer
6. **Add the endpoint** — Copy the matching pattern, replace placeholders, add to controller
7. **Add Swagger decorators** — Every endpoint needs `@ApiOperation`, a response decorator for each status code (`@ApiEnvelopedResponse` if the success response carries a DTO — see `backend:swagger` Rule 2.2 — otherwise `@ApiResponse`), and param decorators
8. **Test** — Verify via Swagger UI at `localhost:3000/api/v1`
9. **Run `pnpm sdk:generate`** from the repo root (backend must be running) — these endpoints are read by the SDK generator; regenerate `@food/sdk` at `libs/sdk` so frontend api-builder hooks get the updated types

## Patterns

### Action Endpoint

```typescript
@Post(':id/activate')
@HttpCode(HttpStatus.OK)
@ApiOperation({ summary: 'Activate {name}' })
@ApiParam({ name: 'id', description: '{PascalName} ID' })
@ApiResponse({ status: 200, description: 'Activated' })
async activate(@Param('id', ParseUUIDPipe) id: string) {
  return this.{camelName}Service.activate(id);
}

@Post(':id/deactivate')
@HttpCode(HttpStatus.OK)
@ApiOperation({ summary: 'Deactivate {name}' })
async deactivate(@Param('id', ParseUUIDPipe) id: string) {
  return this.{camelName}Service.deactivate(id);
}
```

### Search Endpoint

```typescript
@Get('search')
@ApiOperation({ summary: 'Search {name}s' })
@ApiQuery({ name: 'q', required: true, description: 'Search query' })
@ApiQuery({ name: 'status', required: false, enum: ['active', 'inactive'] })
@ApiQuery({ name: 'limit', required: false, type: Number })
async search(
  @Query('q') query: string,
  @Query('status') status?: 'active' | 'inactive',
  @Query('limit') limit?: number,
) {
  return this.{camelName}Service.search(query, { status, limit });
}
```

### File Upload

```typescript
@Post(':id/upload')
@UseInterceptors(FileInterceptor('file'))
@ApiOperation({ summary: 'Upload file for {name}' })
@ApiConsumes('multipart/form-data')
@ApiBody({
  schema: {
    type: 'object',
    properties: {
      file: { type: 'string', format: 'binary' },
    },
  },
})
@ApiResponse({ status: 200, description: 'File uploaded' })
async uploadFile(
  @Param('id', ParseUUIDPipe) id: string,
  @UploadedFile() file: Express.Multer.File,
) {
  return this.{camelName}Service.uploadFile(id, file);
}
```

### Nested Resource

```typescript
@Get(':id/items')
@ApiOperation({ summary: 'Get {name} items' })
@ApiParam({ name: 'id', description: '{PascalName} ID' })
async getItems(@Param('id', ParseUUIDPipe) id: string) {
  return this.{camelName}Service.getItems(id);
}

@Post(':id/items')
@ApiOperation({ summary: 'Add item to {name}' })
async addItem(
  @Param('id', ParseUUIDPipe) id: string,
  @Body() dto: CreateItemDto,
) {
  return this.{camelName}Service.addItem(id, dto);
}

@Delete(':id/items/:itemId')
@HttpCode(HttpStatus.NO_CONTENT)
@ApiOperation({ summary: 'Remove item from {name}' })
async removeItem(
  @Param('id', ParseUUIDPipe) id: string,
  @Param('itemId', ParseUUIDPipe) itemId: string,
) {
  await this.{camelName}Service.removeItem(id, itemId);
}
```

### Batch Operations

```typescript
@Post('batch')
@ApiOperation({ summary: 'Batch create {name}s' })
@ApiBody({ type: [Create{PascalName}Dto] })
@ApiResponse({ status: 201, description: 'Batch created' })
async batchCreate(@Body() dtos: Create{PascalName}Dto[]) {
  return this.{camelName}Service.batchCreate(dtos);
}

@Patch('batch')
@ApiOperation({ summary: 'Batch update {name}s' })
async batchUpdate(@Body() updates: { id: string; data: Update{PascalName}Dto }[]) {
  return this.{camelName}Service.batchUpdate(updates);
}

@Delete('batch')
@HttpCode(HttpStatus.NO_CONTENT)
@ApiOperation({ summary: 'Batch delete {name}s' })
@ApiBody({ schema: { type: 'array', items: { type: 'string', format: 'uuid' } } })
async batchDelete(@Body() ids: string[]) {
  await this.{camelName}Service.batchDelete(ids);
}
```

### Status Update

```typescript
@Patch(':id/status')
@ApiOperation({ summary: 'Update {name} status' })
@ApiBody({
  schema: {
    type: 'object',
    properties: { status: { type: 'string', enum: ['active', 'inactive'] } },
  },
})
async updateStatus(
  @Param('id', ParseUUIDPipe) id: string,
  @Body('status') status: 'active' | 'inactive',
) {
  return this.{camelName}Service.updateStatus(id, status);
}
```

### Archive (Soft Delete)

```typescript
@Delete(':id/archive')
@HttpCode(HttpStatus.NO_CONTENT)
@ApiOperation({ summary: 'Archive {name} (soft delete)' })
async archive(@Param('id', ParseUUIDPipe) id: string) {
  await this.{camelName}Service.archive(id);
}

@Post(':id/restore')
@ApiOperation({ summary: 'Restore archived {name}' })
async restore(@Param('id', ParseUUIDPipe) id: string) {
  return this.{camelName}Service.restore(id);
}
```

## Required Imports

```typescript
import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query,
  HttpCode, HttpStatus,
  ParseUUIDPipe,
  UseInterceptors, UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags, ApiOperation, ApiResponse, ApiBearerAuth,
  ApiParam, ApiQuery, ApiBody, ApiConsumes,
} from '@nestjs/swagger';
import { CurrentUser } from '@auth/decorators/current-user.decorator';
import { Roles } from '@auth/decorators/roles.decorator';
import { Permissions } from '@auth/decorators/permissions.decorator';
import { AuthUser } from '@auth/interfaces/auth-user.interface';
```
