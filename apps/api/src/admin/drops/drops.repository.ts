import { Injectable } from '@nestjs/common';
import { and, asc, desc, eq, inArray, ne, sql } from 'drizzle-orm';
import {
  DbService,
  type Db,
  type DbOrTx,
  type Tx,
} from '../../db/db.service.js';
import {
  deliveryPoints,
  dropDeliveryPoints,
  dropItems,
  drops,
  events,
  orderItems,
  orders,
  restaurants,
} from '../../db/schema.js';

export type DropRow = typeof drops.$inferSelect;
export type DropInsert = typeof drops.$inferInsert;
export type DropItemRow = typeof dropItems.$inferSelect;
export type DropItemInsert = typeof dropItems.$inferInsert;

export interface DropWithRestaurant extends DropRow {
  restaurantName: string;
}

export interface RawCounts {
  paidOnly: number;
  delivered: number;
  submitted: number;
  pending: number;
  expiredOrRejected: number;
}

export interface DropDeliveryPointRow {
  id: string;
  name: string;
  area: string | null;
  isActive: boolean;
}

const count = (cond: ReturnType<typeof sql>) =>
  sql<number>`count(*) filter (where ${cond})`.mapWith(Number);

// §14.2: orders that hold capacity.
const holdsCapacity = sql`(${orders.status} in ('payment_submitted', 'paid') or (${orders.status} = 'pending_payment' and ${orders.expiresAt} > now()))`;

@Injectable()
export class DropsRepository {
  constructor(private readonly dbService: DbService) {}

  transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    return this.dbService.run((db) => db.transaction(fn));
  }

  run<T>(fn: (db: Db) => Promise<T>): Promise<T> {
    return this.dbService.run(fn);
  }

  // ---- reads ---------------------------------------------------------------

  async list(db: DbOrTx): Promise<DropWithRestaurant[]> {
    const rows = await db
      .select({ drop: drops, restaurantName: restaurants.name })
      .from(drops)
      .innerJoin(restaurants, eq(restaurants.id, drops.restaurantId))
      .orderBy(desc(drops.deliveryStartsAt));
    return rows.map((r) => ({ ...r.drop, restaurantName: r.restaurantName }));
  }

  async findById(
    db: DbOrTx,
    id: string,
    opts: { lock?: boolean } = {},
  ): Promise<DropWithRestaurant | null> {
    const q = db
      .select({ drop: drops, restaurantName: restaurants.name })
      .from(drops)
      .innerJoin(restaurants, eq(restaurants.id, drops.restaurantId))
      .where(eq(drops.id, id))
      .limit(1);
    const [row] = opts.lock ? await q.for('update', { of: drops }) : await q;
    return row ? { ...row.drop, restaurantName: row.restaurantName } : null;
  }

  items(db: DbOrTx, dropId: string): Promise<DropItemRow[]> {
    return db
      .select()
      .from(dropItems)
      .where(eq(dropItems.dropId, dropId))
      .orderBy(asc(dropItems.sortOrder), asc(dropItems.createdAt));
  }

  /** drop_item_id → qty across capacity-holding orders (§14.1 sold_qty). */
  async soldQty(db: DbOrTx, dropId: string): Promise<Map<string, number>> {
    const rows = await db
      .select({
        itemId: orderItems.dropItemId,
        qty: sql<number>`sum(${orderItems.qty})`.mapWith(Number),
      })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .where(and(eq(orders.dropId, dropId), holdsCapacity))
      .groupBy(orderItems.dropItemId);
    return new Map(rows.map((r) => [r.itemId, r.qty]));
  }

  deliveryPointsFor(
    db: DbOrTx,
    dropId: string,
  ): Promise<DropDeliveryPointRow[]> {
    return db
      .select({
        id: deliveryPoints.id,
        name: deliveryPoints.name,
        area: deliveryPoints.area,
        isActive: deliveryPoints.isActive,
      })
      .from(dropDeliveryPoints)
      .innerJoin(
        deliveryPoints,
        eq(deliveryPoints.id, dropDeliveryPoints.deliveryPointId),
      )
      .where(eq(dropDeliveryPoints.dropId, dropId))
      .orderBy(asc(deliveryPoints.sortOrder), asc(deliveryPoints.name));
  }

  async counts(db: DbOrTx, dropIds: string[]): Promise<Map<string, RawCounts>> {
    if (dropIds.length === 0) return new Map();
    const rows = await db
      .select({
        dropId: orders.dropId,
        paidOnly: count(sql`${orders.status} = 'paid'`),
        delivered: count(sql`${orders.status} = 'delivered'`),
        submitted: count(sql`${orders.status} = 'payment_submitted'`),
        pending: count(
          sql`${orders.status} = 'pending_payment' and ${orders.expiresAt} > now()`,
        ),
        expiredOrRejected: count(
          sql`${orders.status} in ('expired', 'payment_rejected') or (${orders.status} = 'pending_payment' and ${orders.expiresAt} <= now())`,
        ),
      })
      .from(orders)
      .where(inArray(orders.dropId, dropIds))
      .groupBy(orders.dropId);
    return new Map(rows.map(({ dropId, ...c }) => [dropId, c]));
  }

  async countOpenDrops(db: DbOrTx, excludingId: string): Promise<number> {
    const [row] = await db
      .select({ n: sql<number>`count(*)`.mapWith(Number) })
      .from(drops)
      .where(and(eq(drops.status, 'open'), ne(drops.id, excludingId)));
    return row?.n ?? 0;
  }

  async revenueAndCost(
    db: DbOrTx,
    dropId: string,
  ): Promise<{
    revenuePaise: number;
    foodCostPaise: number;
    missingCost: boolean;
  }> {
    const paid = sql`${orders.status} in ('paid', 'delivered')`;
    const [rev] = await db
      .select({
        revenue: sql<number>`coalesce(sum(${orders.totalPaise}), 0)`.mapWith(
          Number,
        ),
      })
      .from(orders)
      .where(and(eq(orders.dropId, dropId), paid));
    const [cost] = await db
      .select({
        cost: sql<number>`coalesce(sum(${dropItems.costPricePaise} * ${orderItems.qty}), 0)`.mapWith(
          Number,
        ),
        missing: sql<boolean>`coalesce(bool_or(${dropItems.costPricePaise} is null), false)`,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .innerJoin(dropItems, eq(dropItems.id, orderItems.dropItemId))
      .where(and(eq(orders.dropId, dropId), paid));
    return {
      revenuePaise: rev?.revenue ?? 0,
      foodCostPaise: cost?.cost ?? 0,
      missingCost: cost?.missing ?? false,
    };
  }

  async funnel(db: DbOrTx, dropId: string): Promise<Map<string, number>> {
    const rows = await db
      .select({ type: events.type, n: sql<number>`count(*)`.mapWith(Number) })
      .from(events)
      .where(eq(events.dropId, dropId))
      .groupBy(events.type);
    return new Map(rows.map((r) => [r.type, r.n]));
  }

  // ---- writes (callers wrap in a transaction) --------------------------------

  async insertDrop(tx: DbOrTx, values: DropInsert): Promise<DropRow> {
    const [row] = await tx.insert(drops).values(values).returning();
    if (!row) throw new Error('drop insert returned no row');
    return row;
  }

  async updateDrop(
    tx: DbOrTx,
    id: string,
    values: Partial<DropInsert>,
  ): Promise<void> {
    await tx
      .update(drops)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(drops.id, id));
  }

  async insertItems(tx: DbOrTx, rows: DropItemInsert[]): Promise<void> {
    if (rows.length > 0) await tx.insert(dropItems).values(rows);
  }

  async updateItem(
    tx: DbOrTx,
    id: string,
    values: Partial<DropItemInsert>,
  ): Promise<void> {
    await tx
      .update(dropItems)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(dropItems.id, id));
  }

  async deleteItems(tx: DbOrTx, ids: string[]): Promise<void> {
    if (ids.length > 0)
      await tx.delete(dropItems).where(inArray(dropItems.id, ids));
  }

  async replaceDeliveryPoints(
    tx: DbOrTx,
    dropId: string,
    dpIds: string[],
  ): Promise<void> {
    await tx
      .delete(dropDeliveryPoints)
      .where(eq(dropDeliveryPoints.dropId, dropId));
    if (dpIds.length > 0) {
      await tx
        .insert(dropDeliveryPoints)
        .values(dpIds.map((deliveryPointId) => ({ dropId, deliveryPointId })));
    }
  }

  /**
   * §14.7 — drop cancelled: paid/payment_submitted → refund_pending;
   * pending_payment/payment_rejected → cancelled. Returns affected order ids.
   */
  async cascadeCancelOrders(
    tx: DbOrTx,
    dropId: string,
  ): Promise<{ refundPending: number; cancelled: number }> {
    const now = new Date();
    const toRefund = await tx
      .update(orders)
      .set({ status: 'refund_pending', updatedAt: now })
      .where(
        and(
          eq(orders.dropId, dropId),
          inArray(orders.status, ['paid', 'payment_submitted']),
        ),
      )
      .returning({ id: orders.id });
    const toCancel = await tx
      .update(orders)
      .set({ status: 'cancelled', cancelledAt: now, updatedAt: now })
      .where(
        and(
          eq(orders.dropId, dropId),
          inArray(orders.status, ['pending_payment', 'payment_rejected']),
        ),
      )
      .returning({ id: orders.id });
    return { refundPending: toRefund.length, cancelled: toCancel.length };
  }

  async restaurantExists(db: DbOrTx, id: string): Promise<boolean> {
    const [row] = await db
      .select({ id: restaurants.id })
      .from(restaurants)
      .where(eq(restaurants.id, id))
      .limit(1);
    return row !== undefined;
  }

  async existingDeliveryPointIds(
    db: DbOrTx,
    ids: string[],
  ): Promise<Set<string>> {
    if (ids.length === 0) return new Set();
    const rows = await db
      .select({ id: deliveryPoints.id })
      .from(deliveryPoints)
      .where(inArray(deliveryPoints.id, ids));
    return new Set(rows.map((r) => r.id));
  }
}
