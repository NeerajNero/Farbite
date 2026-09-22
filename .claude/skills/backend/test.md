---
name: backend:test
description: Write unit tests for backend services, controllers, strategies. Mandatory after every code generation.
---

# Backend Testing

## When to Use

Both unit **and** integration tests are mandatory after every code generation. They are not optional.
- Every generated `*.service.ts`, `*.controller.ts`, `*.strategy.ts`, and `*.guard.ts` must have a co-located `*.spec.ts` (unit).
- Every new module must have `tests/integration/<module>.integration.spec.ts` (integration).

---

## Test Types

| Type | Location | Command |
|------|----------|---------|
| Unit | `*.spec.ts` (co-located with source) | `pnpm test -- --testPathPatterns="<module>" --no-coverage` |
| Integration | `tests/integration/*.integration.spec.ts` | `pnpm test:integration` (preferred; add `--testPathPatterns="<module>.integration"` for a single module, or use `npx jest --config jest.integration.config.ts --runInBand --forceExit --testPathPatterns="<module>.integration"`) |
| E2E | Playwright | `pnpm test:e2e` (runs `playwright test --project=e2e-tests`). Note: a `jest.e2e.config.ts` exists matching `tests/e2e/**/*.e2e.spec.ts`, but no pnpm script is wired to it |

Unit Jest config: `rootDir: src`, `testRegex: .*\.spec\.ts$` — all spec files live under `src/`.

Integration Jest config: `jest.integration.config.ts` — boots the full NestJS app against real PostgreSQL + Redis (no mocks). See `backend-integration-test-writer` for patterns, setup helpers, and known pitfalls (UUID v4 validation, OTP cooldown, JWT revocation).

---

## Core Pattern: Direct Instantiation

**Do NOT use `Test.createTestingModule` for unit tests.** Instantiate the class directly with mocked constructor arguments. This is faster, simpler, and less fragile.

```typescript
function buildService(mockOverrides = {}) {
  const myDb = {
    findById: jest.fn().mockResolvedValue(MOCK_ENTITY),
    create: jest.fn().mockResolvedValue(MOCK_ENTITY),
    ...mockOverrides.myDb,
  } as unknown as jest.Mocked<MyDbService>;

  const service = new MyService(myDb);
  return { service, myDb };
}

describe('MyService', () => {
  beforeEach(() => jest.clearAllMocks());
  // tests...
});
```

---

## Mocking ConfigService

```typescript
function buildConfigMock(overrides: Record<string, string | undefined> = {}) {
  const defaults = { NODE_ENV: 'development', JWT_ACCESS_EXPIRY: '15m', ...overrides };
  return {
    get: jest.fn((key: string) => defaults[key]),
    getOrThrow: jest.fn((key: string) => {
      if (!defaults[key]) throw new Error(`${key} not configured`);
      return defaults[key];
    }),
  } as unknown as jest.Mocked<ConfigService<EnvConfig>>;
}
```

---

## Mocking External Utilities (path aliases)

```typescript
jest.mock('@common/utils/phone.util', () => ({ normalizeToE164: jest.fn() }));
import { normalizeToE164 } from '@common/utils/phone.util';
const mockNormalize = normalizeToE164 as jest.Mock;
// In beforeEach: mockNormalize.mockReturnValue('+14155550100');
```

---

## TypeScript Strict-Mode Gotchas

### `exactOptionalPropertyTypes` — never assign `undefined` to optional fields in fixtures
```typescript
// WRONG — TS2379
const dto = { email: undefined as string | undefined };
// CORRECT — omit the key or cast as any
const dto = { firstName: 'J' } as any;
```

### Synchronous guard throws — use `expect(() => ...)` not `rejects`
Controller methods that throw synchronously (missing query params) are NOT async rejects:
```typescript
// WRONG
await expect(controller.getList(undefined)).rejects.toThrow(BadRequestException);
// CORRECT
expect(() => controller.getList(undefined)).toThrow(BadRequestException);
```

### DB entity mocks — cast as `any`
Schema types grow as columns are added. Don't type mock objects to the full schema:
```typescript
const MOCK_USER = { userId: 'u1', firstName: 'John', phoneNumber: '+1...' } as any;
```

---

## Service Spec Template

```typescript
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MyService } from './my.service';
import { MyDbService } from '@db/my/my.db-service';

const MOCK_ENTITY = { id: 'e1', name: 'Test' } as any;

function buildService(mockOverrides: { myDb?: Partial<jest.Mocked<MyDbService>> } = {}) {
  const myDb = {
    findById: jest.fn().mockResolvedValue(MOCK_ENTITY),
    findAll: jest.fn().mockResolvedValue([MOCK_ENTITY]),
    create: jest.fn().mockResolvedValue(MOCK_ENTITY),
    update: jest.fn().mockResolvedValue(MOCK_ENTITY),
    delete: jest.fn().mockResolvedValue(undefined),
    ...mockOverrides.myDb,
  } as unknown as jest.Mocked<MyDbService>;

  return { service: new MyService(myDb), myDb };
}

describe('MyService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('findById', () => {
    it('returns entity when found', async () => {
      const { service } = buildService();
      expect(await service.findById('e1')).toMatchObject({ id: 'e1' });
    });

    it('throws NotFoundException when entity does not exist', async () => {
      const { service } = buildService({ myDb: { findById: jest.fn().mockResolvedValue(null) } });
      await expect(service.findById('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('creates and returns entity', async () => {
      const { service, myDb } = buildService();
      const result = await service.create({ name: 'New' } as any);
      expect(myDb.create).toHaveBeenCalledWith(expect.objectContaining({ name: 'New' }));
      expect(result).toMatchObject({ id: 'e1' });
    });
  });

  describe('update', () => {
    it('throws NotFoundException when entity does not exist', async () => {
      const { service } = buildService({ myDb: { findById: jest.fn().mockResolvedValue(null) } });
      await expect(service.update('missing', {} as any)).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('returns success after delete', async () => {
      const { service } = buildService();
      expect(await service.remove('e1')).toEqual({ success: true });
    });
  });
});
```

---

## Controller Spec Template

```typescript
import { BadRequestException } from '@nestjs/common';
import { MyController } from './my.controller';
import { MyService } from './my.service';
import { AuthUser } from '@auth/interfaces/auth-user.interface';

const MOCK_USER: AuthUser = {
  userId: 'u1', id: 'u1', firstName: 'J', lastName: 'D',
  phoneNumber: null, email: null, roles: [], permissions: [],
};

function buildController() {
  const myService = {
    findAll: jest.fn().mockResolvedValue([]),
    findById: jest.fn().mockResolvedValue({ id: 'e1' }),
    create: jest.fn().mockResolvedValue({ id: 'e1' }),
    update: jest.fn().mockResolvedValue({ id: 'e1' }),
    remove: jest.fn().mockResolvedValue({ success: true }),
  } as unknown as jest.Mocked<MyService>;

  return { controller: new MyController(myService), myService };
}

describe('MyController', () => {
  describe('findById', () => {
    it('delegates to service with id and userId', async () => {
      const { controller, myService } = buildController();
      await controller.findById('e1', MOCK_USER);
      expect(myService.findById).toHaveBeenCalledWith('e1', 'u1');
    });
  });

  describe('getList', () => {
    it('throws BadRequestException when required query param is missing', () => {
      const { controller } = buildController();
      // Synchronous throw — DO NOT use rejects
      expect(() => controller.getList(undefined)).toThrow(BadRequestException);
    });

    it('delegates to service when param is present', async () => {
      const { controller, myService } = buildController();
      await controller.getList('value');
      expect(myService.findAll).toHaveBeenCalledWith('value');
    });
  });
});
```

---

## Strategy Spec Template

```typescript
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MyStrategy } from './my.strategy';
import { UserAuthDbService } from '@db/auth/user-auth.db-service';

function buildStrategy(userReturn: Record<string, unknown> | null = { userId: 'u1', firstName: 'J', lastName: 'D', phoneNumber: null, email: null }) {
  const config = { getOrThrow: jest.fn().mockReturnValue('test-secret') } as unknown as ConfigService<any>;
  const userAuthDb = { findById: jest.fn().mockResolvedValue(userReturn) } as unknown as jest.Mocked<UserAuthDbService>;
  return { strategy: new MyStrategy(config, userAuthDb), userAuthDb };
}

describe('MyStrategy', () => {
  describe('validate', () => {
    it('throws UnauthorizedException for wrong token type', async () => {
      const { strategy } = buildStrategy();
      await expect(strategy.validate({ sub: 'u1', type: 'refresh' })).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when user not found', async () => {
      const { strategy } = buildStrategy(null);
      await expect(strategy.validate({ sub: 'ghost', type: 'access' })).rejects.toThrow(UnauthorizedException);
    });

    it('returns AuthUser for valid access token', async () => {
      const { strategy } = buildStrategy();
      const result = await strategy.validate({ sub: 'u1', type: 'access' });
      expect(result).toMatchObject({ userId: 'u1' });
    });
  });
});
```

---

## Required Coverage Checklist

### Service
- [ ] Happy path for every public method
- [ ] `NotFoundException` when entity/user not found
- [ ] `ConflictException` when duplicate (if applicable)
- [ ] `BadRequestException` for invalid input (if applicable)
- [ ] `ForbiddenException` for restricted operations (if applicable)
- [ ] `HttpException 429` for rate-limited/locked paths (if applicable)

### Controller
- [ ] Every endpoint delegates to service with correct arguments
- [ ] Missing required query params → `BadRequestException` (sync throw — not `rejects`)
- [ ] Header/token extraction produces correct derived value (e.g. SHA-256 hash for logout)

### Strategy / Guard
- [ ] Wrong token type → `UnauthorizedException`
- [ ] Entity not found in DB → `UnauthorizedException`
- [ ] Valid payload → returns expected object

---

## Commands

```bash
# Run tests for a specific module
pnpm test -- --testPathPatterns="auth" --no-coverage

# Run all unit tests
pnpm test

# Watch mode during development
pnpm test -- --watch --testPathPatterns="my-module"
```
