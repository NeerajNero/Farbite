import { Controller, Get } from '@nestjs/common';
import type { HealthResponse } from '@farbite/shared';
import { DbService } from '../db/db.service.js';

// Public (no internal key): PLAN.md §10. Lives outside the /v1 prefix.
@Controller('health')
export class HealthController {
  constructor(private readonly dbService: DbService) {}

  @Get()
  async health(): Promise<HealthResponse> {
    return { ok: true, db: await this.dbService.ping() };
  }
}
