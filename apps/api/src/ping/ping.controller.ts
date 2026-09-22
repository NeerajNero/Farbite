import { Controller, Get, Req } from '@nestjs/common';
import type { Actor, RequestWithActor } from '../common/guards/actor.guard.js';

// Phase 0 smoke endpoint (recorded in DECISIONS.md): the only guarded route
// until Phase 2, used to prove InternalKeyGuard + ActorGuard work end-to-end.
@Controller('ping')
export class PingController {
  @Get()
  ping(@Req() req: RequestWithActor): { pong: true; actor: Actor } {
    return { pong: true, actor: req.actor };
  }
}
