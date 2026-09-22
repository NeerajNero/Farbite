import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';

export type Actor =
  | { type: 'guest' }
  | { type: 'user'; userId: string; email: string };

export interface RequestWithActor extends Request {
  actor: Actor;
}

// Builds req.actor from the identity headers the BFF forwards (PLAN.md §7.2).
// Trust model: InternalKeyGuard has already proven the request came from our
// Next.js server, so these headers are trustworthy.
@Injectable()
export class ActorGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<RequestWithActor>();

    const actorType = req.header('x-actor-type');
    const userId = req.header('x-user-id');
    const email = req.header('x-user-email');

    req.actor =
      actorType === 'user' && userId && email
        ? { type: 'user', userId, email: email.toLowerCase() }
        : { type: 'guest' };

    return true;
  }
}
