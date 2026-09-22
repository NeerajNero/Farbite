---
name: backend:typescript
description: TypeScript strict mode patterns and common fixes for the backend
---

# Backend TypeScript Patterns

## Trigger

Use when fixing TypeScript errors or following strict mode conventions in `./`.

## Steps

1. **Run `pnpm type-check`** to surface all errors
2. **Fix `exactOptionalPropertyTypes` errors first** — use `??` for defaults, `?` for truly optional props
3. **Fix `noUncheckedIndexedAccess` errors** — guard array/object access with `?? defaultValue` or a conditional
4. **Fix `noUnusedLocals` / `noUnusedParameters`** — prefix unused params with `_` or remove them
5. **Replace all `any`** with `unknown` and narrow with type guards, or use the specific type
6. **Use `import type`** for all type-only imports (`verbatimModuleSyntax`)
7. **Never use `as T` to silence an error** — fix the underlying type mismatch
8. **Re-run `pnpm type-check`** — must exit with 0 errors before committing

## Strict Mode Settings

```json
{
  "strict": true,
  "exactOptionalPropertyTypes": true,
  "noUncheckedIndexedAccess": true,
  "noUnusedLocals": true,
  "noUnusedParameters": true,
  "noPropertyAccessFromIndexSignature": true
}
```

## Common Patterns

### ConfigService Returns Undefined

```typescript
// BAD
const port = configService.get<number>('PORT'); // number | undefined

// GOOD
const port = configService.get<number>('PORT') ?? 3000;

// Or with assertion (only if truly required)
const apiKey = configService.getOrThrow<string>('API_KEY');
```

### Array Index Access

```typescript
// BAD
const first = items[0]; // T | undefined
console.log(first.name); // Error!

// GOOD
const first = items[0];
if (first) {
  console.log(first.name);
}

// Or with assertion (only if guaranteed)
const first = items[0]!; // Use sparingly
```

### Optional Properties

```typescript
// BAD (exactOptionalPropertyTypes)
interface Config {
  region?: string;
}
const config: Config = { region: undefined }; // Error!

// GOOD - Omit the property
const config: Config = {};

// GOOD - Conditional assignment
const config: Config = {};
if (region) {
  config.region = region;
}

// GOOD - Change type to include undefined
interface Config {
  region?: string | undefined;
}
```

### Unused Variables

```typescript
// BAD
function process(data: Data, options: Options) { // options unused
  return transform(data);
}

// GOOD - Prefix with underscore
function process(data: Data, _options: Options) {
  return transform(data);
}
```

### Index Signature Access

```typescript
// BAD (noPropertyAccessFromIndexSignature)
interface Dict { [key: string]: string; }
const dict: Dict = { a: '1' };
console.log(dict.a); // Error!

// GOOD - Use bracket notation
console.log(dict['a']);
```

### Type Narrowing

```typescript
// Null checks
if (value !== null && value !== undefined) {
  // value is defined
}

// Type guards
function isUser(obj: unknown): obj is User {
  return typeof obj === 'object' && obj !== null && 'email' in obj;
}

// Discriminated unions
type Result = { success: true; data: Data } | { success: false; error: string };
if (result.success) {
  // result.data is available
} else {
  // result.error is available
}
```

### Async/Await Types

```typescript
// Return type annotation
async function fetchUser(id: string): Promise<User | null> {
  const result = await repository.findById(id);
  return result ?? null;
}

// Handle Promise arrays
const results = await Promise.all(ids.map(id => findById(id)));
const validResults = results.filter((r): r is User => r !== undefined);
```

### Generic Constraints

```typescript
// Ensure type has id property
function findById<T extends { id: string }>(items: T[], id: string): T | undefined {
  return items.find(item => item.id === id);
}

// Key constraints
function pick<T, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  // ...
}
```

### Drizzle Specific

```typescript
// Infer insert type
type NewUser = typeof users.$inferInsert;

// Infer select type
type User = typeof users.$inferSelect;

// Handle query results
const results = await db.select().from(users).where(eq(users.id, id));
const user = results[0]; // User | undefined
if (user) {
  return user;
}
throw new NotFoundException();
```

## Import Organization

```typescript
// 1. External packages
import { Injectable } from '@nestjs/common';
import { eq, desc } from 'drizzle-orm';

// 2. Internal aliases
import { DBService } from '@db/db.service';
import { users } from '@db/drizzle/schema';
import { RouteNames } from '@common/route-names';

// 3. Relative imports
import { CreateUserDto } from './dto/create-user.dto';
import { UserService } from './user.service';
```

## Type-Only Imports

```typescript
// Use 'import type' for types only
import type { User } from './interfaces/user.interface';
import type { AuthUser } from '@auth/interfaces/auth-user.interface';

// Regular import for values
import { Injectable } from '@nestjs/common';
```

## Security Rules

- **Helmet** — security headers are applied globally via `app.use(helmet())`
- **ThrottlerGuard** — rate limiting is applied globally; override per-route with `@Throttle()`
- **ValidationPipe** — global, with `whitelist: true` and `transform: true`; strips unknown properties automatically
- **Input sanitization** — sanitize user-submitted HTML with `sanitize-html` before storing
- **Never expose internal errors** — use `HttpExceptionFilter` to catch unhandled errors and return generic messages; see `backend:error-handling`
- **No secrets in code** — always use `ConfigService` for API keys, DB credentials, JWT secrets
- **Parameterized queries** — Drizzle ORM handles this; never interpolate user input into raw SQL strings

## File Naming

- Files: `kebab-case` (`user-profile.service.ts`, `jwt-auth.guard.ts`)
- Classes: `PascalCase` (`UserProfileService`, `JwtAuthGuard`)
- Methods/variables: `camelCase` (`findById`, `accessToken`)
- Constants: `UPPER_CASE` (`MAX_RETRY_COUNT`, `DEFAULT_PAGE_SIZE`)

