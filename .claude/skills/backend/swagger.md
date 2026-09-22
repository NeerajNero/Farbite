---
name: backend:swagger
description: Define explicit, complete Swagger (OpenAPI) contracts in NestJS controllers and DTOs to ensure successful SDK generation
---

# Swagger (OpenAPI) Contract Design

## Trigger
Use when:
- Creating or modifying NestJS controllers or DTOs.
- Building new endpoints or updating request/response shapes.
- Preparing to run `pnpm sdk:generate`.

## Why Explicit Swagger Contracts Matter
The client SDK is generated directly from the backend's OpenAPI schema (obtained from the live backend server). If Swagger decorators are missing, incomplete, or incorrectly configured, the generated SDK will have:
- Missing fields in request/response models.
- Methods typed as returning `any` or `void`.
- Runtime errors or crashed builds due to circular dependencies.
- Collapsed schemas where models override each other.

Follow these strict rules to prevent SDK generation failures.

---

## 1. DTO Best Practices (Data Layer)

### Rule 1.1: Annotate EVERY Single Field
Never rely on the NestJS CLI plugin to auto-discover types. Every property in a DTO class must have an explicit Swagger decorator:
- Use `@ApiProperty(...)` for **required** fields.
- Use `@ApiPropertyOptional(...)` for **optional** fields.

```typescript
// ❌ BAD - Missing Swagger decorator (field won't appear in SDK model)
export class CreateUserDto {
  username: string;
}

// ✅ GOOD - Explicitly decorated with metadata
export class CreateUserDto {
  @ApiProperty({ description: 'The unique username of the user', example: 'john_doe' })
  @IsString()
  @IsNotEmpty()
  username: string;
}
```

### Rule 1.2: Class Names Must Be Globally Unique
Never name DTOs generically (e.g., `ResponseDto`, `CreateDto`, `FilterDto`). Swagger collapses schemas with identical names.
- Always prefix DTOs with the domain module name.

```typescript
// ❌ BAD - Will cause schema conflict/overwrite in OpenAPI definition
export class ResponseDto {}

// ✅ GOOD - Uniquely prefixed
export class UserResponseDto {}
```

### Rule 1.3: Nested DTOs & Circular Dependencies
When a DTO contains another DTO (nested object or array of objects), use lazy loading `() => DTOClass` inside the `type` property. This prevents runtime circular dependency crashes.

```typescript
// ❌ BAD - Direct reference can lead to circular import/ref issues
@ApiProperty({ type: ProfileDto })
profile: ProfileDto;

// ✅ GOOD - Lazy-loaded function reference
@ApiProperty({ type: () => ProfileDto })
profile: ProfileDto;
```

### Rule 1.4: Arrays of DTOs
When a property is an array of custom DTO objects, explicitly specify both `type: () => Class` and `isArray: true`.

```typescript
// ❌ BAD - Array syntax in type property is often misinterpreted by generators
@ApiProperty({ type: [PostResponseDto] })
posts: PostResponseDto[];

// ✅ GOOD - Clearly defined array of objects
@ApiProperty({ type: () => PostResponseDto, isArray: true })
@IsArray()
@ValidateNested({ each: true })
@Type(() => PostResponseDto)
posts: PostResponseDto[];
```

### Rule 1.5: Documenting Enums
Always include the `enum` property and specify the enum type in `@ApiProperty` so the SDK generator exports the actual TypeScript enum rather than a raw `string`.

```typescript
export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
}

// ❌ BAD - Generator will just see a raw string
@ApiProperty({ example: 'user' })
role: UserRole;

// ✅ GOOD - Generator maps it to the UserRole enum
@ApiProperty({ enum: UserRole, enumName: 'UserRole', example: UserRole.USER })
@IsEnum(UserRole)
role: UserRole;
```

### Rule 1.6: Nullable primitive fields MUST declare an explicit `type`
A `@ApiProperty`/`@ApiPropertyOptional` with `nullable: true` on a **primitive** field (`string`/`number`/`boolean`) must also pass `type: String | Number | Boolean`. When `nullable: true` is present but `type` is omitted, NestJS Swagger emits a schema with **no type**, and openapi-generator falls back to `object`. The generated SDK field then becomes `object | null` instead of the real primitive (e.g. `renewalDate?: object | null` instead of `string | null`) — consumers cannot use it without casting, and it silently defeats the whole point of a typed SDK.

This is the single most common SDK-typing bug in this codebase — it has recurred across feeds, subscription, location, matches, and media DTOs. Grep the generated models for it after `pnpm sdk:generate`: `grep -rnE '\??:\s*object( \| null)?;' libs/sdk/src/generated/v1/models | grep -v 'meta?: object'`.

```typescript
// ❌ BAD - no `type`; SDK generates `streetAddress?: object | null`
@ApiPropertyOptional({ description: 'Full street address', nullable: true })
streetAddress!: string | null;

// ✅ GOOD - explicit type; SDK generates `streetAddress?: string | null`
@ApiPropertyOptional({ description: 'Full street address', type: String, nullable: true })
streetAddress!: string | null;

// ✅ number / boolean fields likewise
@ApiPropertyOptional({ type: Number, nullable: true })  priceCents!: number | null;
@ApiPropertyOptional({ type: Boolean, nullable: true }) hasFaceDetected!: boolean | null;
```

**Exceptions (leave as-is):** a field carrying `enum:` already implies its type — no `type` needed. A field that is genuinely a free-form JSON object (e.g. a permissive webhook payload, an arbitrary `data`/`meta` bag) is *correctly* `object`; do not force a primitive `type` on it.

---

## 2. Controller Best Practices (Route Layer)

### Rule 2.1: Specify Return Types on ALL Methods
Every route handler in a controller must specify a return type, and it **must not** return generic types like `any`, `Record<string, any>`, or raw Express `Response` objects.

```typescript
// ❌ BAD - Returns generic object, SDK method will be typed as returning 'any'
@Get(':id')
async findOne(@Param('id') id: string): Promise<any> {
  return this.service.findOne(id);
}

// ✅ GOOD - Returns an explicit DTO instance
@Get(':id')
async findOne(@Param('id') id: string): Promise<UserResponseDto> {
  return this.service.findOne(id);
}
```

### Rule 2.2: Set HTTP Status Codes Explicitly — success responses MUST use `ApiEnvelopedResponse`
Every controller response is wrapped at runtime by the global `TransformInterceptor` (`src/interceptors/transform.interceptor.ts`) into `{ statusCode, status, message, data, error }`. **Never document a success response with bare `@ApiResponse({ type: X })`, `@ApiOkResponse`, or `@ApiCreatedResponse`** — that documents the unwrapped DTO, which is not what the wire response actually looks like. openapi-generator bakes that lie into the SDK, and the generated client deserializes fields straight off the envelope instead of `envelope.data` (e.g. `phone: undefined`, `expiresAt: Invalid Date`).

Use `ApiEnvelopedResponse(status, description, Model, options?)` from `@common/decorators/api-enveloped-response.decorator` for every success response that carries a DTO. It documents the real envelope shape via `@ApiExtraModels` + `allOf`/`getSchemaPath`, so the generated SDK model correctly parses `data`. Error responses (4xx/5xx, no body DTO) keep using plain `@ApiResponse({ status, description })` — no `type:`.

```typescript
import { ApiEnvelopedResponse } from '@common/decorators/api-enveloped-response.decorator';

// ❌ BAD - Documents the unwrapped DTO; SDK will read fields off the envelope, not envelope.data
@ApiResponse({ status: 201, description: 'User created successfully', type: UserResponseDto })

// ✅ GOOD - Documents { statusCode, status, message, data: UserResponseDto, error }
@Post()
@HttpCode(HttpStatus.CREATED)
@ApiOperation({ summary: 'Register a new user' })
@ApiEnvelopedResponse(201, 'User created successfully', UserResponseDto)
@ApiResponse({ status: 400, description: 'Invalid validation payload' })
async register(@Body() dto: CreateUserDto): Promise<UserResponseDto> {
  return this.authService.register(dto);
}

// ✅ GOOD - Array responses (e.g. list endpoints) pass { isArray: true }
@Get()
@ApiOperation({ summary: 'List users' })
@ApiEnvelopedResponse(200, 'List of users', UserResponseDto, { isArray: true })
async findAll(): Promise<UserResponseDto[]> {
  return this.usersService.findAll();
}
```

### Rule 2.3: Avoid Generic Paginated Wrappers
NestJS Swagger cannot dynamically map generic classes like `PaginatedResponseDto<T>` at runtime. 
Instead, create a custom helper factory to build paginated DTO shapes, or declare an explicit inherited class for each domain.

```typescript
// ❌ BAD - Swagger loses the type argument <UserResponseDto> and generates an empty/generic response schema
@ApiResponse({ status: 200, type: PaginatedResponseDto<UserResponseDto> })

// ✅ GOOD - Extend the shared PaginatedResponseDto factory (concrete per item type).
//    Yields { items, pagination: { pageNo, pageSize, totalCount, totalPages } } — see backend:pagination.
import { PaginatedResponseDto } from '@common/pagination/pagination.dto';
export class UserPaginatedResponseDto extends PaginatedResponseDto(UserResponseDto) {}

// In Controller (still goes through ApiEnvelopedResponse — see Rule 2.2):
@ApiEnvelopedResponse(200, 'Paginated users', UserPaginatedResponseDto)
```

### Rule 2.4: Standardised API Response Envelope
Every response is wrapped by the global `TransformInterceptor` into `{ statusCode, status, message, data, error }` (base class: `ApiResponse<T>` in `src/common/dto/api-response.ts`, fully `@ApiProperty`-decorated). Rather than hand-writing a concrete subclass per DTO (`UserApiResponse extends ApiResponse<UserResponseDto>` with a `declare data` override — tempting, but it means a second class for every response DTO in the codebase), use the reusable `ApiEnvelopedResponse` decorator, which builds the same envelope schema on the fly via `@ApiExtraModels` + `allOf`/`getSchemaPath`:

```typescript
// src/common/decorators/api-enveloped-response.decorator.ts
export function ApiEnvelopedResponse<TModel extends Type<unknown>>(
  status: number,
  description: string,
  model: TModel,
  options?: { isArray?: boolean },
) { /* ApiExtraModels(ApiResponse, model) + allOf: [ApiResponse schema, { data: model|array-of-model }] */ }

// ❌ BAD - Controller specifies the bare DTO; Swagger (and the generated SDK) don't see the envelope
@ApiResponse({ status: 200, type: UserResponseDto })
async findOne(@Param('id') id: string): Promise<UserResponseDto> {
  return this.service.findOne(id);
}

// ✅ GOOD - Documents { statusCode, status, message, data: UserResponseDto, error }
@Get(':id')
@ApiEnvelopedResponse(200, 'User found', UserResponseDto)
async findOne(@Param('id') id: string): Promise<UserResponseDto> {
  return this.service.findOne(id);
  // TransformInterceptor wraps this return value into the envelope at runtime —
  // the controller keeps returning the bare DTO, only the Swagger doc changes.
}

// Combining Pagination + Standard Envelope — extend the shared factory (see backend:pagination):
import { PaginatedResponseDto } from '@common/pagination/pagination.dto';
import { getPaginationDetails } from '@common/pagination/pagination.util';

export class UserPaginatedData extends PaginatedResponseDto(UserResponseDto) {}

@Get()
@ApiEnvelopedResponse(200, 'Paginated users', UserPaginatedData)
async findAll(@Query() query: UserQueryDto): Promise<UserPaginatedData> {
  const { rows, total } = await this.service.findAll(query);
  return {
    items: rows,
    pagination: getPaginationDetails(total, { pageNo: query.page, pageSize: query.limit }),
  };
}
```

Note: controller methods keep returning the bare DTO (`Promise<UserResponseDto>`) — `TransformInterceptor` does the actual wrapping at runtime. `ApiEnvelopedResponse` only changes what Swagger *documents*, bringing the docs in line with what already happens on the wire.

---

## 3. Document ALL Possible Status Codes (REQUIRED on every endpoint)

Every endpoint must declare an `@ApiResponse` decorator for **every HTTP status code it can return** — success and failure. This rule applies to every new feature and every modification to an existing endpoint. SDK consumers rely on these annotations to understand error handling at compile time.

### Rule 3.1: Required status codes per endpoint type

| Endpoint type | Status codes to document |
|---|---|
| `POST` (create) | 201, 400, 401, 409 (if unique constraint), 429 (if rate-limited) |
| `POST` (action) | 200, 400, 401, 404 (if resource must exist), 409 (if state conflict) |
| `GET` (list) | 200, 401 |
| `GET` (single) | 200, 401, 404 |
| `PATCH` / `PUT` | 200, 400, 401, 404, 409 (if conflict) |
| `DELETE` | 204, 401, 404 |
| Any endpoint using optional service | add 503 (service unavailable) |

### Rule 3.2: Pattern — full example with all status codes

```typescript
@Post('sessions/start')
@HttpCode(HttpStatus.CREATED)
@ApiBearerAuth()
@ApiOperation({ summary: 'Start a new interview session' })
@ApiEnvelopedResponse(201, 'Session started successfully', StartSessionResponseDto)
@ApiResponse({ status: 400, description: 'Validation error — missing or malformed request body' })
@ApiResponse({ status: 401, description: 'Missing or invalid Bearer token' })
@ApiResponse({ status: 409, description: 'An active session already exists for this user' })
async startSession(@CurrentUser() user: AuthUser): Promise<StartSessionResponseDto> {
  return this.interviewService.startSession(user.userId);
}
```

### Rule 3.3: Auth annotation on every protected endpoint

Any endpoint guarded by `JwtAuthGuard` (directly or via a global guard) must include:
```typescript
@ApiBearerAuth()
@ApiResponse({ status: 401, description: 'Missing or invalid Bearer token' })
```

### Rule 3.4: Tag ordering — Auth always first

In `src/main.ts`, the `DocumentBuilder` must call `.addTag('Auth', ...)` before all other `.addTag(...)` calls. This ensures Auth is the first section in Swagger UI regardless of discovery order.

When adding a new module's tag, append it after the existing tags in the builder. Do not reorder existing tags.

```ts
const v1Config = new DocumentBuilder()
  .addBearerAuth()
  .addTag('Auth', 'Authentication — sign-up, login, OTP, token refresh, session management')
  .addTag('Interview', '...')
  .addTag('NewFeature', '...')   // ← append here
  .build();
```

---

## 4. Module Registration in `main.ts` (REQUIRED for Swagger visibility)

Adding a module to `app.module.ts` enables routing but does **not** make its endpoints appear in Swagger or the generated SDK. Every versioned business module must also be added to `V1_MODULES` in `src/main.ts`.

```ts
// src/main.ts

// 1. Add the import at the top with the other business module imports
import { FeatureModule } from './api/feature/feature.module';

// 2. Add to V1_MODULES
const V1_MODULES = [
  AuthModule,
  FeatureModule,   // ← new module here
  UsersModule,
  // ...
];
```

**Why two registrations?**
- `app.module.ts` → NestJS dependency injection + route binding (makes endpoints callable)
- `main.ts` `V1_MODULES` → Swagger `include` filter (makes endpoints visible in UI and OpenAPI JSON)

A module missing from `V1_MODULES` will silently route correctly but produce zero Swagger entries — and `pnpm sdk:generate` will miss the entire module.

---

## 5. Verification Checklist Before SDK Generation

Run the following sanity checks before triggering the client SDK generation:
1. [ ] **Module in `V1_MODULES`**: Confirm the new module is in `src/main.ts` `V1_MODULES` AND imported at the top of the file.
2. [ ] **Tag added to DocumentBuilder**: A `.addTag('FeatureName', '...')` call is present in `main.ts` (appended after existing tags).
3. [ ] **All status codes documented**: Every endpoint has a response decorator for every possible HTTP status code it returns — `@ApiEnvelopedResponse` for success responses that carry a DTO, plain `@ApiResponse({ status, description })` for error paths.
4. [ ] **Auth 401 on every protected endpoint**: Every `@ApiBearerAuth()` endpoint also has `@ApiResponse({ status: 401, ... })`.
5. [ ] **No untyped endpoints**: Every controller endpoint specifies a return type that is a DTO or void.
6. [ ] **No raw decorators**: Check that all DTO fields use `@ApiProperty` or `@ApiPropertyOptional`.
7. [ ] **Nullable primitives typed** (Rule 1.6): every `nullable: true` primitive field also has `type: String|Number|Boolean`. After generating, confirm no field regressed to `object`: `grep -rnE '\??:\s*object( \| null)?;' libs/sdk/src/generated/v1/models | grep -v 'meta?: object'` returns only genuinely free-form payloads.
8. [ ] **Circular dependency check**: Search DTOs for nested relationships and ensure they use `() => NestedDto` syntax.
8. [ ] **Run type check & inspect live schema**: 
   - Start the backend: `pnpm backend:up`
   - Access `http://localhost:3000/api/v1-json` in browser or curl it to ensure it contains complete schemas for all response models and the new module's tag is present.
