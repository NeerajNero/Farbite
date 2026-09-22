---
name: backend:controller
description: Create NestJS controller with Swagger documentation and proper decorators
---

# Backend Controller

## Trigger

Use when creating or modifying controllers in `./`.

## Steps

1. **Read the spec** — Identify all endpoints (method, route, auth, request/response shapes)
2. **Check existing controllers** — Read `src/{module}/` to see if a controller already exists. If so, add endpoints to it (see `backend:endpoint` skill)
3. **Create DTOs first** — Define all request/response DTOs before the controller (see `backend:dto` skill)
4. **Create service first** — Implement the service methods the controller will delegate to (see `backend:service` skill)
5. **Add route to `RouteNames`** — Register the path in `src/common/route-names.ts` (never hardcode route strings)
6. **Scaffold the controller** — Use the template below, replacing placeholders
7. **Add Swagger decorators** — Every endpoint needs `@ApiOperation`, `@ApiEnvelopedResponse` for success responses with a body DTO (or `@ApiResponse` for error paths), and param/query decorators (see `backend:swagger` skill for rules on return types, arrays, and pagination shapes)
8. **Register in module** — Add the controller to the module's `controllers` array
9. **Test via Swagger** — Start the backend and verify all endpoints appear at `localhost:3000/api/v1`
10. **Run `pnpm sdk:generate`** from the repo root (backend must be running at `localhost:3000`) — controller endpoints with Swagger decorators are consumed by the SDK generator; regenerate `@food/sdk` at `libs/sdk` so the frontend can consume the new domain via `sdk.{domain}.*`

## Template

```typescript
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { RouteNames } from '@common/route-names';
import { ApiEnvelopedResponse } from '@common/decorators/api-enveloped-response.decorator';
import { CurrentUser } from '@auth/decorators/current-user.decorator';
import { Roles } from '@auth/decorators/roles.decorator';
import { Permissions } from '@auth/decorators/permissions.decorator';
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

  @Post()
  @ApiOperation({ summary: 'Create a new {name}' })
  @ApiEnvelopedResponse(201, '{PascalName} created', {PascalName}ResponseDto)
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async create(
    @Body() dto: Create{PascalName}Dto,
    @CurrentUser() user: AuthUser,
  ): Promise<{PascalName}ResponseDto> {
    return this.{camelName}Service.create({ ...dto, userId: user.userId });
  }

  @Get()
  @ApiOperation({ summary: 'List all {name}s' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  async findAll(
    @Query('search') search?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.{camelName}Service.findAll({ search, limit, offset });
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current user\'s {name}s' })
  async findMine(@CurrentUser() user: AuthUser) {
    return this.{camelName}Service.findByUserId(user.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get {name} by ID' })
  @ApiParam({ name: 'id', description: '{PascalName} ID (UUID)' })
  @ApiEnvelopedResponse(200, '{PascalName} found', {PascalName}ResponseDto)
  @ApiResponse({ status: 404, description: 'Not found' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.{camelName}Service.findById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update {name}' })
  @ApiParam({ name: 'id', description: '{PascalName} ID' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: Update{PascalName}Dto,
  ) {
    return this.{camelName}Service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete {name}' })
  @ApiParam({ name: 'id', description: '{PascalName} ID' })
  @ApiResponse({ status: 204, description: 'Deleted' })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.{camelName}Service.remove(id);
  }
}
```

## Conventions

- Use `RouteNames` enum for paths (never hardcoded strings)
- Always add `@ApiTags`, `@ApiBearerAuth`
- Each method needs `@ApiOperation` and a response decorator per status code — `@ApiEnvelopedResponse` for success responses with a body DTO, `@ApiResponse` for error paths (see `backend:swagger`)
- Use `ParseUUIDPipe` for ID params
- Use `@CurrentUser()` for authenticated user
- Use `@Roles('admin')` (OR logic) or `@Permissions('domain:write')` (AND logic) for authorization (see `backend:guard`)
- Keep controllers thin — delegate to service
