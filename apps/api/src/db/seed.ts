// Idempotent seed (PLAN.md Phase 1): 1 restaurant, 5 delivery points, 1 draft
// drop with 6 items, 1 admin user from ADMIN_EMAILS. Placeholder data — real
// restaurant/menu/PGs get seeded before the pilot. Safe to run repeatedly:
// every insert is check-then-insert on a natural key.
// Run: pnpm db:seed  (tsx --env-file=.env src/db/seed.ts)
import { and, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.js';

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** Next occurrence of `weekday` (0=Sun) at hh:mm IST, as a UTC Date. */
function nextIST(weekday: number, hour: number, minute: number): Date {
  const nowIST = new Date(Date.now() + IST_OFFSET_MS);
  const result = new Date(nowIST);
  result.setUTCHours(hour, minute, 0, 0);
  let daysAhead = (weekday - nowIST.getUTCDay() + 7) % 7;
  if (daysAhead === 0 && result <= nowIST) daysAhead = 7;
  result.setUTCDate(result.getUTCDate() + daysAhead);
  return new Date(result.getTime() - IST_OFFSET_MS);
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required to seed');
  const pool = new pg.Pool({ connectionString: url, max: 2 });
  const db = drizzle(pool, { schema });

  // 1 restaurant (placeholder)
  const restaurantName = 'Tandoor Junction (Test)';
  let [restaurant] = await db
    .select()
    .from(schema.restaurants)
    .where(eq(schema.restaurants.name, restaurantName));
  if (!restaurant) {
    [restaurant] = await db
      .insert(schema.restaurants)
      .values({
        name: restaurantName,
        area: 'Indiranagar',
        address: '100 Feet Rd, Indiranagar, Bengaluru',
        phone: '9800000000',
        notes: 'Placeholder restaurant — replace before pilot.',
      })
      .returning();
    console.log('+ restaurant');
  }
  if (!restaurant) throw new Error('restaurant insert failed');

  // 5 delivery points (placeholders)
  const pgSeeds = [
    { name: 'Sunrise PG (Gents)', area: 'Marathahalli', landmark: 'Gate next to Chai Point' },
    { name: 'Green Nest PG (Ladies)', area: 'Marathahalli', landmark: 'Opp. water tank' },
    { name: 'Blue Orchid PG', area: 'Kundalahalli', landmark: 'Beside SBI ATM' },
    { name: 'Comfort Stay PG', area: 'Brookefield', landmark: 'Next to gym' },
    { name: 'Hilltop Residency PG', area: 'Whitefield', landmark: 'Main gate, security cabin' },
  ];
  const deliveryPointIds: string[] = [];
  for (const [i, seedRow] of pgSeeds.entries()) {
    let [dp] = await db
      .select()
      .from(schema.deliveryPoints)
      .where(eq(schema.deliveryPoints.name, seedRow.name));
    if (!dp) {
      [dp] = await db
        .insert(schema.deliveryPoints)
        .values({ ...seedRow, handoverNotes: 'Call security at the gate.', sortOrder: i })
        .returning();
      console.log(`+ delivery point: ${seedRow.name}`);
    }
    if (dp) deliveryPointIds.push(dp.id);
  }

  // 1 admin user from ADMIN_EMAILS
  const adminEmail = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)[0];
  if (adminEmail) {
    const [existing] = await db.select().from(schema.users).where(eq(schema.users.email, adminEmail));
    if (!existing) {
      await db.insert(schema.users).values({ email: adminEmail, isAdmin: true });
      console.log(`+ admin user: ${adminEmail}`);
    } else if (!existing.isAdmin) {
      await db.update(schema.users).set({ isAdmin: true }).where(eq(schema.users.id, existing.id));
      console.log(`~ promoted to admin: ${adminEmail}`);
    }
  } else {
    console.warn('! ADMIN_EMAILS empty — no admin user seeded');
  }

  // 1 draft drop with 6 items (placeholder menu)
  const deliveryStartsAt = nextIST(6, 13, 0); // Sat 13:00 IST
  const deliveryEndsAt = nextIST(6, 14, 30); // Sat 14:30 IST
  const cutoffAt = new Date(deliveryStartsAt.getTime() - 16 * 60 * 60 * 1000); // Fri 21:00 IST
  const dropTitle = `${restaurantName} — Test Drop`;

  let [drop] = await db.select().from(schema.drops).where(eq(schema.drops.title, dropTitle));
  if (!drop) {
    [drop] = await db
      .insert(schema.drops)
      .values({
        restaurantId: restaurant.id,
        title: dropTitle,
        description: 'Placeholder drop for development. Replace with a real weekend drop.',
        status: 'draft',
        cutoffAt,
        deliveryStartsAt,
        deliveryEndsAt,
        minOrders: 10,
        maxOrders: 40,
        deliveryFeePaise: 2000, // ₹20
        customerNotes: 'Food arrives at your PG gate; bring your order code.',
        internalNotes: 'Seed data — do not publish.',
      })
      .returning();
    console.log('+ draft drop');
  }
  if (!drop) throw new Error('drop insert failed');

  const menuSeeds = [
    { name: 'Paneer Butter Masala', pricePaise: 26000, costPricePaise: 21000, isVeg: true },
    { name: 'Chicken Biryani (Full)', pricePaise: 32000, costPricePaise: 26000, isVeg: false },
    { name: 'Veg Fried Rice', pricePaise: 18000, costPricePaise: 14000, isVeg: true },
    { name: 'Butter Naan (2 pc)', pricePaise: 8000, costPricePaise: 6000, isVeg: true },
    { name: 'Chicken 65', pricePaise: 24000, costPricePaise: 19000, isVeg: false },
    { name: 'Gulab Jamun (2 pc)', pricePaise: 9000, costPricePaise: 6500, isVeg: true },
  ];
  for (const [i, item] of menuSeeds.entries()) {
    const [existing] = await db
      .select()
      .from(schema.dropItems)
      .where(and(eq(schema.dropItems.dropId, drop.id), eq(schema.dropItems.name, item.name)));
    if (!existing) {
      await db.insert(schema.dropItems).values({ ...item, dropId: drop.id, sortOrder: i });
      console.log(`+ drop item: ${item.name}`);
    }
  }

  // Drop serves all seeded PGs
  for (const dpId of deliveryPointIds) {
    await db
      .insert(schema.dropDeliveryPoints)
      .values({ dropId: drop.id, deliveryPointId: dpId })
      .onConflictDoNothing();
  }

  await pool.end();
  console.log('Seed complete (idempotent).');
}

await main();
