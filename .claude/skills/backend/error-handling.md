---
name: backend:error-handling
description: Throw the correct NestJS exception for every failure case — maps to HTTP status codes and the standard ApiResponse error shape
---

# Backend Error Handling

## Trigger

Use whenever a feature service needs to throw an exception, or when handling PostgreSQL constraint errors in a repository or DB service.

## Steps

1. **Choose the exception** from the table below — match the failure case to the correct NestJS exception class
2. **Throw in the feature service**, not in the controller or repository
3. **For PostgreSQL errors** (duplicate key, FK violation) — catch in the DB service or feature service and rethrow as the appropriate NestJS exception
4. **Never swallow errors silently** — always rethrow as a typed NestJS exception so `HttpExceptionFilter` can format the response
5. **Never throw raw `Error`** — always use NestJS exceptions so the response gets the correct HTTP status code and `traceId`

## Exception Reference

| Situation | Exception to throw | HTTP status |
|-----------|-------------------|-------------|
| Resource not found by ID | `NotFoundException` | 404 |
| Duplicate / unique constraint | `ConflictException` | 409 |
| Invalid input / business rule violation | `BadRequestException` | 400 |
| Not logged in / token missing or expired | `UnauthorizedException` | 401 |
| Logged in but insufficient role/permission | `ForbiddenException` | 403 |
| Upstream service / third-party failed | `ServiceUnavailableException` | 503 |
| Unexpected internal failure | `InternalServerErrorException` | 500 |
| Operation not supported | `NotImplementedException` | 501 |

## Templates

### Standard Not Found

```typescript
import { NotFoundException } from '@nestjs/common';

const item = await this.{camelName}Db.findById(id);
if (!item) {
  throw new NotFoundException(`{PascalName} with ID "${id}" not found`);
}
```

### Duplicate / Conflict

```typescript
import { ConflictException } from '@nestjs/common';

const existing = await this.{camelName}Db.findByEmail(dto.email);
if (existing) {
  throw new ConflictException(`{PascalName} with email "${dto.email}" already exists`);
}
```

### PostgreSQL Constraint Errors (catch in DB service)

> **Note:** The global `ErrorHandlerService` already maps PG error codes centrally (`PG_ERROR_MAP`: 23505→409, 23503→400, 23502→400, etc. in `src/common/services/error-handler.service.ts`), so per-service try/catch of `DatabaseError` is only needed when you want a custom message — not for the mapping itself.

```typescript
import { ConflictException, BadRequestException } from '@nestjs/common';
import { DatabaseError } from 'pg';

async create(data: Create{PascalName}Dto) {
  try {
    return await this.{camelName}Repo.create(data);
  } catch (err) {
    if (err instanceof DatabaseError) {
      if (err.code === '23505') throw new ConflictException('Record already exists');
      if (err.code === '23503') throw new BadRequestException('Referenced resource does not exist');
    }
    throw err; // re-throw unknown errors
  }
}
```

### PostgreSQL Error Codes Reference

| Code | Meaning | Throw |
|------|---------|-------|
| `23505` | Unique violation | `ConflictException` |
| `23503` | Foreign key violation | `BadRequestException` |
| `23502` | Not null violation | `BadRequestException` |
| `22001` | String too long | `BadRequestException` |
| `42P01` | Undefined table | `InternalServerErrorException` |

### Business Rule Violation

```typescript
import { BadRequestException } from '@nestjs/common';

if (dto.endDate <= dto.startDate) {
  throw new BadRequestException('End date must be after start date');
}
```

### Permission / Ownership Check

```typescript
import { ForbiddenException } from '@nestjs/common';

if (item.userId !== currentUser.id && !currentUser.roles.includes(RoleType.ADMIN)) {
  throw new ForbiddenException('You do not have access to this resource');
}
```

## Response Shape

All exceptions are caught by the global `HttpExceptionFilter` and formatted as:

```json
{
  "statusCode": 404,
  "status": "Failure",
  "message": "{PascalName} with ID \"abc\" not found",
  "error": "Not Found",
  "data": null,
  "traceId": "abc-123-xyz"
}
```

## Conventions

- Throw exceptions in **feature services** — not in controllers, not in repositories
- PostgreSQL-specific errors (`DatabaseError`) — catch in the **DB service**, translate to NestJS exceptions, rethrow
- Always include the resource ID or offending value in the message for debuggability
- Never use `throw new Error(...)` — always use the NestJS exception classes
- The global `HttpExceptionFilter` at `src/common/filters/http-exception.filter.ts` handles formatting
- See `backend:service` for where to place these throws in the service layer
