import { Injectable } from '@nestjs/common';
import { DbService, type DbOrTx } from '../db/db.service.js';
import { events } from '../db/schema.js';

// Event types (PLAN.md §6 events.type / §13 funnel).
export type EventType =
  | 'drop_viewed'
  | 'checkout_started'
  | 'order_placed'
  | 'utr_submitted'
  | 'payment_verified'
  | 'payment_rejected'
  | 'order_expired'
  | 'order_revived'
  | 'drop_confirmed'
  | 'drop_cancelled'
  | 'order_delivered';

export interface LogEventInput {
  type: EventType;
  dropId?: string;
  orderId?: string;
  /** 'guest' | user_id | 'system' | 'admin:<user_id>' */
  actor: string;
  meta?: Record<string, unknown>;
}

@Injectable()
export class EventsRepository {
  constructor(private readonly dbService: DbService) {}

  /** Append-only. Pass `tx` to log inside the caller's transaction. */
  async log(input: LogEventInput, tx?: DbOrTx): Promise<void> {
    const db = tx ?? this.dbService.db;
    await db.insert(events).values({
      type: input.type,
      dropId: input.dropId ?? null,
      orderId: input.orderId ?? null,
      actor: input.actor,
      meta: input.meta ?? null,
    });
  }
}
