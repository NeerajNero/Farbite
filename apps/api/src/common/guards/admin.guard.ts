import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppException } from '../errors/app.exception.js';
import { UsersService } from '../../users/users.service.js';
import type { RequestWithActor } from './actor.guard.js';

// PLAN.md §7.2: admin = actor.email ∈ ADMIN_EMAILS AND users.is_admin = true.
// The env check is cheap and runs first; the DB check makes the API the
// source of truth even if a stale JWT claims is_admin.
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService,
    private readonly usersService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<RequestWithActor>();
    const actor = req.actor;

    const adminEmails = this.config.get<string[]>('ADMIN_EMAILS') ?? [];
    if (actor?.type !== 'user' || !adminEmails.includes(actor.email)) {
      throw new AppException(
        'FORBIDDEN',
        'Admin access required',
        HttpStatus.FORBIDDEN,
      );
    }
    if (!(await this.usersService.isAdmin(actor.userId, actor.email))) {
      throw new AppException(
        'FORBIDDEN',
        'Admin access required',
        HttpStatus.FORBIDDEN,
      );
    }
    return true;
  }
}
