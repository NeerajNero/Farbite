import { Injectable } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import { DbService } from '../../db/db.service.js';
import { restaurants } from '../../db/schema.js';

export type RestaurantRow = typeof restaurants.$inferSelect;
export type RestaurantInsert = typeof restaurants.$inferInsert;

@Injectable()
export class RestaurantsRepository {
  constructor(private readonly dbService: DbService) {}

  list(): Promise<RestaurantRow[]> {
    return this.dbService.run((db) =>
      db.select().from(restaurants).orderBy(asc(restaurants.name)),
    );
  }

  async findById(id: string): Promise<RestaurantRow | null> {
    return this.dbService.run(async (db) => {
      const [row] = await db
        .select()
        .from(restaurants)
        .where(eq(restaurants.id, id))
        .limit(1);
      return row ?? null;
    });
  }

  async create(values: RestaurantInsert): Promise<RestaurantRow> {
    return this.dbService.run(async (db) => {
      const [row] = await db.insert(restaurants).values(values).returning();
      if (!row) throw new Error('restaurant insert returned no row');
      return row;
    });
  }

  async update(
    id: string,
    values: Partial<RestaurantInsert>,
  ): Promise<RestaurantRow | null> {
    return this.dbService.run(async (db) => {
      const [row] = await db
        .update(restaurants)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(restaurants.id, id))
        .returning();
      return row ?? null;
    });
  }
}
