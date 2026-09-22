import { Controller, Get } from '@nestjs/common';
import type { HealthResponse } from '@weekend-drop/shared';
import { DbHealthService } from './db-health.service.js';

// Public (no internal key): PLAN.md §10. Lives outside the /v1 prefix.
@Controller('health')
export class HealthController {
  constructor(private readonly dbHealth: DbHealthService) {}

  @Get()
  async health(): Promise<HealthResponse> {
    return { ok: true, db: await this.dbHealth.check() };
  }
}
