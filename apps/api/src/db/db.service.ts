import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.js';

export type Db = NodePgDatabase<typeof schema>;
/** A transaction handle (what `db.transaction(async (tx) => …)` hands you). */
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
/** Either the root db or a transaction — repositories accept both. */
export type DbOrTx = Db | Tx;

const RETRYABLE = new Set(['ECONNRESET', 'EPIPE', '57P01', 'ETIMEDOUT']);

// Single pg pool + Drizzle instance for the whole API (PLAN.md §7.4 Neon
// notes: low idleTimeout, tolerate dropped connections with one retry).
// DATABASE_URL is optional only under NODE_ENV=test (DB-less e2e tests).
@Injectable()
export class DbService implements OnModuleDestroy {
  private readonly logger = new Logger(DbService.name);
  private readonly pool: pg.Pool | null;
  private readonly _db: Db | null;

  constructor(config: ConfigService) {
    const url = config.get<string>('DATABASE_URL');
    if (url) {
      this.pool = new pg.Pool({
        connectionString: url,
        max: 5,
        idleTimeoutMillis: 10_000,
      });
      // Idle clients dropped by Neon emit 'error' on the pool; without a
      // listener that would crash the process.
      this.pool.on('error', (err) =>
        this.logger.warn(`pg pool idle client error: ${err.message}`),
      );
      this._db = drizzle(this.pool, { schema });
    } else {
      this.pool = null;
      this._db = null;
    }
  }

  get isConfigured(): boolean {
    return this._db !== null;
  }

  get db(): Db {
    if (!this._db) throw new Error('DATABASE_URL is not configured');
    return this._db;
  }

  /** Run `fn` against the db, retrying once on a dropped connection. */
  async run<T>(fn: (db: Db) => Promise<T>): Promise<T> {
    try {
      return await fn(this.db);
    } catch (err) {
      if (!isRetryable(err)) throw err;
      this.logger.warn(`retrying query after connection error: ${String(err)}`);
      return fn(this.db);
    }
  }

  async ping(): Promise<boolean> {
    if (!this.pool) return false;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        await this.pool.query('select 1');
        return true;
      } catch (err) {
        this.logger.warn(`DB ping attempt ${attempt} failed: ${String(err)}`);
      }
    }
    return false;
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool?.end();
  }
}

function isRetryable(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const code = (err as { code?: unknown }).code;
  return typeof code === 'string' && RETRYABLE.has(code);
}
