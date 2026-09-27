import { Injectable } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import { DbService } from '../db/db.service.js';
import { users } from '../db/schema.js';

export interface UpsertUserInput {
  email: string;
  name?: string | null | undefined;
  image?: string | null | undefined;
  isAdmin: boolean;
}

@Injectable()
export class UsersRepository {
  constructor(private readonly dbService: DbService) {}

  /** Insert or refresh on sign-in; name/image only overwrite when provided. */
  async upsertOnSignIn(
    input: UpsertUserInput,
  ): Promise<{ id: string; isAdmin: boolean }> {
    return this.dbService.run(async (db) => {
      const [row] = await db
        .insert(users)
        .values({
          email: input.email,
          name: input.name ?? null,
          image: input.image ?? null,
          isAdmin: input.isAdmin,
          lastLoginAt: new Date(),
        })
        .onConflictDoUpdate({
          target: users.email,
          set: {
            name: sql`coalesce(${sql.raw('excluded.name')}, ${users.name})`,
            image: sql`coalesce(${sql.raw('excluded.image')}, ${users.image})`,
            isAdmin: input.isAdmin,
            lastLoginAt: new Date(),
            updatedAt: new Date(),
          },
        })
        .returning({ id: users.id, isAdmin: users.isAdmin });
      if (!row) throw new Error('users upsert returned no row');
      return row;
    });
  }

  /** True when a user row with this id + email exists and is_admin = true. */
  async isAdmin(userId: string, email: string): Promise<boolean> {
    return this.dbService.run(async (db) => {
      const [row] = await db
        .select({ isAdmin: users.isAdmin })
        .from(users)
        .where(and(eq(users.id, userId), eq(users.email, email)))
        .limit(1);
      return row?.isAdmin === true;
    });
  }
}
