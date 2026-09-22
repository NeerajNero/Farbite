import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import { AppException } from '../errors/app.exception.js';

// Public exceptions to the internal-key requirement (PLAN.md §7.2):
// health check and the Razorpay webhook (Phase 7).
const PUBLIC_PATHS = new Set(['/health', '/v1/webhooks/razorpay']);

@Injectable()
export class InternalKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    if (PUBLIC_PATHS.has(req.path)) return true;

    const expected = this.config.getOrThrow<string>('INTERNAL_API_KEY');
    const provided = req.header('x-internal-key') ?? '';
    if (!safeEqual(provided, expected)) {
      throw new AppException('UNAUTHORIZED', 'Missing or invalid internal key', HttpStatus.UNAUTHORIZED);
    }
    return true;
  }
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
