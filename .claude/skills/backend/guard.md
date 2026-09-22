---
name: backend:guard
description: Create custom guards and decorators for authorization
---

# Backend Guards & Decorators

## Trigger

Use when creating authorization guards or custom decorators in `./`.

## Steps

1. **Read the existing guards first** — read `src/api/auth/guards/` and how they're registered in `src/app.module.ts` before adding new ones; never invent new role logic
2. **Identify the need** — Is this role-based, ownership-based, feature-flag, or custom logic?
3. **Check existing guards** — Review `src/api/auth/guards/` and the guard chain below. Reuse before creating.
4. **Choose guard type**:
   - Restrict by role → use existing `@Roles()` decorator
   - Restrict to resource owner → Ownership Guard template
   - Toggle by config flag → Feature Flag Guard template
   - Custom authorization logic → Custom Guard template
5. **Create the guard file** — Place in `src/api/auth/guards/` (global) or `src/{module}/guards/` (module-scoped)
6. **Create decorator** — If the guard needs metadata, create a companion decorator (Metadata or Param template)
7. **Register the guard** — Global (APP_GUARD in app.module) or scoped (`@UseGuards()` on controller/method)
8. **Verify guard order** — New guard must fit the existing chain: `ThrottlerGuard → JwtAuthGuard → RolesGuard → PermissionsGuard → YourGuard`

## Templates

### Custom Guard

```typescript
// {guard-name}.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { AuthUser } from '@auth/interfaces/auth-user.interface';

export const {METADATA_KEY} = '{metadata-key}';

@Injectable()
export class {PascalName}Guard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string>(
      {METADATA_KEY},
      [context.getHandler(), context.getClass()],
    );

    if (!required) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as AuthUser;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Check authorization
    // if (!user.hasPermission(required)) {
    //   throw new ForbiddenException(`Requires ${required}`);
    // }

    return true;
  }
}
```

### Ownership Guard

```typescript
@Injectable()
export class OwnershipGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly resourceService: ResourceService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as AuthUser;
    const resourceId = request.params.id;

    if (!resourceId) return true;

    const resource = await this.resourceService.findById(resourceId);
    if (!resource) return true; // Let 404 be thrown by controller

    // Note: AuthUser.roles is currently deprecated/always [] (no RBAC in Food yet) — role checks here are scaffolding for future use
    if (resource.userId !== user.userId && !user.roles?.includes('admin')) {
      throw new ForbiddenException('You can only access your own resources');
    }

    return true;
  }
}
```

### Feature Flag Guard

```typescript
export const FEATURE_KEY = 'feature';
export const RequireFeature = (feature: string) => SetMetadata(FEATURE_KEY, feature);

@Injectable()
export class FeatureFlagGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const feature = this.reflector.get<string>(FEATURE_KEY, context.getHandler());
    if (!feature) return true;

    const enabled = this.configService.get<boolean>(`FEATURE_${feature.toUpperCase()}`);
    if (!enabled) {
      throw new ForbiddenException(`Feature "${feature}" is not enabled`);
    }

    return true;
  }
}
```

### Custom Decorator (Metadata)

```typescript
// {decorator}.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const {METADATA_KEY} = '{metadata-key}';
export const {PascalDecorator} = (value: string) => SetMetadata({METADATA_KEY}, value);

// Usage: @{PascalDecorator}('value')
```

### Custom Decorator (Param)

```typescript
// {decorator}.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

export const {PascalDecorator} = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const value = request.headers['x-custom-header'] as string;
    return data ? value?.[data] : value;
  },
);

// Usage: @{PascalDecorator}() header: string
```

## Registration

### Global Guard

```typescript
// app.module.ts
import { APP_GUARD } from '@nestjs/core';

@Module({
  providers: [
    {
      provide: APP_GUARD,
      useClass: {PascalName}Guard,
    },
  ],
})
```

### Controller/Method Level

```typescript
@UseGuards({PascalName}Guard)
@Controller('resource')
export class ResourceController {
  
  @UseGuards(OwnershipGuard)
  @Get(':id')
  findOne() {}
}
```

## Existing Guards (Order)

```
ThrottlerGuard → JwtAuthGuard → RolesGuard → PermissionsGuard
```

- `@Public()` — skips JWT guard
- `@Roles('admin', 'user')` — OR logic
- `@Permissions('users:read')` — AND logic
