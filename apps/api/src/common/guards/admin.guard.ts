import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppException } from '../errors/app.exception.js';
import type { RequestWithActor } from './actor.guard.js';

// Phase 0 stub: checks actor.email ∈ ADMIN_EMAILS. Phase 2 adds the second
// condition, users.is_admin = true (PLAN.md §7.2).
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<RequestWithActor>();
    const actor = req.actor;

    const adminEmails = this.config.get<string[]>('ADMIN_EMAILS') ?? [];
    if (actor?.type !== 'user' || !adminEmails.includes(actor.email)) {
      throw new AppException('FORBIDDEN', 'Admin access required', HttpStatus.FORBIDDEN);
    }
    // TODO(Phase 2): also require users.is_admin = true from the DB.
    return true;
  }
}
