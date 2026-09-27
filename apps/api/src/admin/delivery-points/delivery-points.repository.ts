import { Injectable } from '@nestjs/common';
import { asc, eq, inArray } from 'drizzle-orm';
import { DbService } from '../../db/db.service.js';
import { deliveryPoints } from '../../db/schema.js';

export type DeliveryPointRow = typeof deliveryPoints.$inferSelect;
export type DeliveryPointInsert = typeof deliveryPoints.$inferInsert;

@Injectable()
export class DeliveryPointsRepository {
  constructor(private readonly dbService: DbService) {}

  list(): Promise<DeliveryPointRow[]> {
    return this.dbService.run((db) =>
      db
        .select()
        .from(deliveryPoints)
        .orderBy(asc(deliveryPoints.sortOrder), asc(deliveryPoints.name)),
    );
  }

  /** Ids (of the given list) that exist. Used to validate drop delivery points. */
  async existingIds(ids: string[]): Promise<string[]> {
    if (ids.length === 0) return [];
    return this.dbService.run(async (db) => {
      const rows = await db
        .select({ id: deliveryPoints.id })
        .from(deliveryPoints)
        .where(inArray(deliveryPoints.id, ids));
      return rows.map((r) => r.id);
    });
  }

  async create(values: DeliveryPointInsert): Promise<DeliveryPointRow> {
    return this.dbService.run(async (db) => {
      const [row] = await db.insert(deliveryPoints).values(values).returning();
      if (!row) throw new Error('delivery point insert returned no row');
      return row;
    });
  }

  async update(
    id: string,
    values: Partial<DeliveryPointInsert>,
  ): Promise<DeliveryPointRow | null> {
    return this.dbService.run(async (db) => {
      const [row] = await db
        .update(deliveryPoints)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(deliveryPoints.id, id))
        .returning();
      return row ?? null;
    });
  }
}
