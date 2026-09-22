---
name: backend:dto
description: Create DTOs with class-validator decorators and Swagger documentation
---

# Backend DTOs

## Trigger

Use when creating or modifying DTOs in `./`.

## Steps

1. **Read the spec** — Identify all request/response fields, their types, which are required vs optional, and validation rules
2. **Check existing DTOs** — Look in `src/{module}/dto/` for DTOs you can extend or reuse
3. **Create in this order**:
   - **Create DTO first** — defines the canonical field set with validation
   - **Update DTO second** — extends Create via `PartialType` (all fields optional)
   - **Response DTO third** — defines what the API returns (may omit sensitive fields, add computed fields)
   - **List Response DTO last** — wraps Response DTO array with pagination metadata
4. **Add validators** — Every field needs at least one `class-validator` decorator. Use `@Transform` for sanitization (trim, lowercase)
5. **Add Swagger decorators** — Every field needs `@ApiProperty` (required) or `@ApiPropertyOptional` (optional) with examples (see `backend:swagger` skill to handle nested objects, arrays, enums, nullable primitives, and unique DTO naming safely). **Nullable primitive fields must pass an explicit `type`** — `@ApiPropertyOptional({ type: String, nullable: true })` — or the generated SDK field regresses to `object | null` (swagger Rule 1.6).
6. **Wire to controller** — Use Create DTO on `@Body()` for POST, Update DTO for PATCH, Response DTO as return type

## Templates

### Create DTO

```typescript
// create-{module-name}.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEmail,
  IsUUID,
  IsNumber,
  IsBoolean,
  IsEnum,
  IsArray,
  IsUrl,
  IsDateString,
  MinLength,
  MaxLength,
  Min,
  Max,
  ValidateNested,
  ArrayMinSize,
  Matches,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class Create{PascalName}Dto {
  @ApiProperty({ description: 'Name', example: 'Example Name' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  name: string;

  @ApiPropertyOptional({ description: 'Description' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ enum: ['active', 'inactive'], default: 'active' })
  @IsEnum(['active', 'inactive'])
  @IsOptional()
  status?: 'active' | 'inactive';

  @ApiProperty({ description: 'Amount in cents', example: 1000 })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiPropertyOptional({ description: 'Tags', type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];
}
```

### Update DTO

```typescript
// update-{module-name}.dto.ts
import { PartialType } from '@nestjs/swagger';
import { Create{PascalName}Dto } from './create-{module-name}.dto';

export class Update{PascalName}Dto extends PartialType(Create{PascalName}Dto) {}
```

### Response DTO

```typescript
// {module-name}-response.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

export class {PascalName}ResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @Expose()
  id: string;

  @ApiProperty({ example: 'Example Name' })
  @Expose()
  name: string;

  @ApiPropertyOptional()
  @Expose()
  description?: string;

  @ApiProperty({ enum: ['active', 'inactive'] })
  @Expose()
  status: 'active' | 'inactive';

  @ApiProperty({ type: String, format: 'date-time', example: '2024-01-01T00:00:00.000Z' })
  @Expose()
  createdAt: string;

  @ApiProperty({ type: String, format: 'date-time', example: '2024-01-01T00:00:00.000Z' })
  @Expose()
  updatedAt: string;
}
```

### List Response DTO

Extend the shared **`PaginatedResponseDto`** factory — never hand-declare a
`PaginationMeta` class or an inline `{ items, pagination }` shape. It yields
`{ items, pagination: { pageNo, pageSize, totalCount, totalPages } }` (see
`backend:pagination` for the full flow + the `getPaginationDetails` helper).

```typescript
// {module-name}-list-response.dto.ts
import { PaginatedResponseDto } from '@common/pagination/pagination.dto';
import { {PascalName}ResponseDto } from './{module-name}-response.dto';

// Concrete class per item type so Swagger / the SDK resolve a real schema
// (a generic PaginatedResponseDto<T> can't be reflected — see backend:swagger Rule 2.3).
export class {PascalName}ListResponseDto extends PaginatedResponseDto({PascalName}ResponseDto) {}
```

## Common Validators

```typescript
// UUID
@IsUUID()
userId: string;

// Email
@IsEmail()
email: string;

// URL
@IsUrl()
@IsOptional()
websiteUrl?: string;

// Date (ISO 8601 input — use 'date-time' for datetime, 'date' for date-only)
@ApiProperty({ type: String, format: 'date-time', example: '2024-01-01T00:00:00.000Z' })
@IsDateString()
startDate: string;

// Date-only input
@ApiProperty({ type: String, format: 'date', example: '2024-01-01' })
@IsDateString()
birthDate: string;

// Nested object
@ValidateNested()
@Type(() => AddressDto)
address: AddressDto;

// Array of nested
@ValidateNested({ each: true })
@Type(() => ItemDto)
@ArrayMinSize(1)
items: ItemDto[];

// Regex pattern
@Matches(/^[a-z0-9-]+$/, { message: 'Must be kebab-case' })
slug: string;

// Conditional validation
@ValidateIf(o => o.type === 'premium')
@IsNotEmpty()
premiumFeature?: string;
```

## Conventions

- **Date fields always use `string` TypeScript type** (never `Date`) — use `@ApiProperty({ type: String, format: 'date-time', example: '2024-01-01T00:00:00.000Z' })` for datetime fields and `format: 'date'` for date-only fields; bare `@ApiProperty()` on a date field generates `unknown` in the SDK
- Always use `class-validator` decorators
- Always use `@ApiProperty` / `@ApiPropertyOptional` — **always include `type` and `example`**; bare `@ApiProperty()` produces `unknown` in the generated SDK
- For enums: also include `enum` and `enumName` — `@ApiProperty({ enum: MyEnum, enumName: 'MyEnum', example: MyEnum.Value })`
- For nested objects: `@ApiProperty({ type: () => NestedDto })`; arrays: `@ApiProperty({ type: () => [NestedDto] })`
- **Class names must be globally unique** — prefix with domain (`UserResponseDto`, not `ResponseDto`); duplicate names collapse schemas in the OpenAPI spec
- Every success response must be documented with `@ApiEnvelopedResponse(status, description, ResponseDto)` (from `@common/decorators/api-enveloped-response.decorator`), never a bare `@ApiResponse({ type: ResponseDto })` — every response is wrapped in the `{ statusCode, status, message, data, error }` envelope at runtime, and `ApiEnvelopedResponse` is what documents that shape correctly (see `backend:swagger` Rule 2.2). Swagger follows the DTO recursively through all nested `@ApiProperty` types to build the full schema.
- Inline helper/nested classes need full `@ApiProperty` on every field or they become bare `object` in the SDK
- **Paginated lists:** don't hand-declare an items/meta shape — `extends PaginatedResponseDto(ItemDto)` from `@common/pagination/pagination.dto` (yields `{ items, pagination }`); see `backend:pagination`
- Use `@Transform` for sanitization (trim, lowercase)
- Update DTO extends `PartialType(CreateDto)`
- Response DTOs use `@Expose()` with class-transformer
