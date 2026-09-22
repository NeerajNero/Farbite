import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import pg from 'pg';

// Minimal pg pool for the health check. Drizzle + the real DB layer arrive in
// Phase 1. Neon suspends idle compute, so keep idleTimeoutMillis low and treat
// one failed attempt as retryable (PLAN.md §7.4).
@Injectable()
export class DbHealthService implements OnModuleDestroy {
  private readonly logger = new Logger(DbHealthService.name);
  private readonly pool: pg.Pool | null;

  constructor(config: ConfigService) {
    const url = config.get<string>('DATABASE_URL');
    this.pool = url
      ? new pg.Pool({ connectionString: url, max: 2, idleTimeoutMillis: 10_000 })
      : null;
  }

  async check(): Promise<boolean> {
    if (!this.pool) return false;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        await this.pool.query('select 1');
        return true;
      } catch (err) {
        this.logger.warn(`DB health check attempt ${attempt} failed: ${String(err)}`);
      }
    }
    return false;
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool?.end();
  }
}
