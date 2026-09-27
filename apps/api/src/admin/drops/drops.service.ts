import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import type {
  CreateDropBody,
  Drop,
  DropCounts,
  DropDashboard,
  DropItem,
  DropItemInput,
  DropListItem,
  TransitionDropBody,
  UpdateDropBody,
} from '@farbite/shared';
import { DROP_FUNNEL_STEPS } from '@farbite/shared';
import type { Actor } from '../../common/guards/actor.guard.js';
import { actorLabel } from '../../common/actor.js';
import { AppException } from '../../common/errors/app.exception.js';
import type { DbOrTx } from '../../db/db.service.js';
import {
  canConfirmDrop,
  canTransitionDrop,
  DROP_TRANSITION_TIMESTAMP,
} from '../../domain/drop-state-machine.js';
import { EventsRepository } from '../../events/events.repository.js';
import {
  canPublishDrop,
  validateDropPatch,
  type DropSnapshot,
} from './drop-edit-rules.js';
import {
  DropsRepository,
  type DropItemInsert,
  type DropItemRow,
  type DropWithRestaurant,
  type RawCounts,
} from './drops.repository.js';

const iso = (d: Date | null) => (d ? d.toISOString() : null);
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function toCounts(
  raw: RawCounts | undefined,
  drop: DropWithRestaurant,
): DropCounts {
  const c = raw ?? {
    paidOnly: 0,
    delivered: 0,
    submitted: 0,
    pending: 0,
    expiredOrRejected: 0,
  };
  return {
    paid: c.paidOnly + c.delivered,
    submitted: c.submitted,
    pending: c.pending,
    expired_or_rejected: c.expiredOrRejected,
    delivered: c.delivered,
    capacity_used: c.paidOnly + c.submitted + c.pending,
    min_orders: drop.minOrders,
    max_orders: drop.maxOrders,
  };
}

function toListItem(
  drop: DropWithRestaurant,
  counts: DropCounts,
): DropListItem {
  return {
    id: drop.id,
    restaurant_id: drop.restaurantId,
    restaurant_name: drop.restaurantName,
    title: drop.title,
    description: drop.description,
    status: drop.status,
    cutoff_at: drop.cutoffAt.toISOString(),
    delivery_starts_at: drop.deliveryStartsAt.toISOString(),
    delivery_ends_at: drop.deliveryEndsAt.toISOString(),
    min_orders: drop.minOrders,
    max_orders: drop.maxOrders,
    delivery_fee_paise: drop.deliveryFeePaise,
    customer_notes: drop.customerNotes,
    internal_notes: drop.internalNotes,
    opened_at: iso(drop.openedAt),
    closed_at: iso(drop.closedAt),
    confirmed_at: iso(drop.confirmedAt),
    out_for_delivery_at: iso(drop.outForDeliveryAt),
    delivered_at: iso(drop.deliveredAt),
    cancelled_at: iso(drop.cancelledAt),
    cancel_reason: drop.cancelReason,
    created_at: drop.createdAt.toISOString(),
    updated_at: iso(drop.updatedAt),
    counts,
  };
}

function toItemDto(row: DropItemRow, soldQty: number): DropItem {
  return {
    id: row.id,
    drop_id: row.dropId,
    name: row.name,
    description: row.description,
    price_paise: row.pricePaise,
    cost_price_paise: row.costPricePaise,
    is_veg: row.isVeg,
    max_qty_per_order: row.maxQtyPerOrder,
    max_total_qty: row.maxTotalQty,
    sort_order: row.sortOrder,
    is_available: row.isAvailable,
    sold_qty: soldQty,
  };
}

function itemInsert(
  dropId: string,
  row: DropItemInput,
  fallbackSort: number,
): DropItemInsert {
  return {
    dropId,
    name: row.name,
    description: row.description ?? null,
    pricePaise: row.price_paise,
    costPricePaise: row.cost_price_paise ?? null,
    isVeg: row.is_veg ?? true,
    maxQtyPerOrder: row.max_qty_per_order ?? 5,
    maxTotalQty: row.max_total_qty ?? null,
    sortOrder: row.sort_order ?? fallbackSort,
    isAvailable: row.is_available ?? true,
  };
}

function itemPatch(
  row: DropItemInput,
  allowed: 'all' | 'open',
): Partial<DropItemInsert> {
  const p: Partial<DropItemInsert> = {};
  if (row.description !== undefined) p.description = row.description;
  if (row.cost_price_paise !== undefined)
    p.costPricePaise = row.cost_price_paise;
  if (row.max_total_qty !== undefined) p.maxTotalQty = row.max_total_qty;
  if (row.sort_order !== undefined) p.sortOrder = row.sort_order;
  if (row.is_available !== undefined) p.isAvailable = row.is_available;
  if (allowed === 'all') {
    p.name = row.name;
    p.pricePaise = row.price_paise;
    if (row.is_veg !== undefined) p.isVeg = row.is_veg;
    if (row.max_qty_per_order !== undefined)
      p.maxQtyPerOrder = row.max_qty_per_order;
  }
  return p;
}

@Injectable()
export class DropsService {
  private readonly logger = new Logger(DropsService.name);

  constructor(
    private readonly repo: DropsRepository,
    private readonly events: EventsRepository,
  ) {}

  // ---- reads ---------------------------------------------------------------

  async list(): Promise<DropListItem[]> {
    return this.repo.run(async (db) => {
      const rows = await this.repo.list(db);
      const counts = await this.repo.counts(
        db,
        rows.map((r) => r.id),
      );
      return rows.map((r) => toListItem(r, toCounts(counts.get(r.id), r)));
    });
  }

  getById(id: string): Promise<Drop> {
    return this.repo.run((db) => this.load(db, id));
  }

  private async load(
    db: DbOrTx,
    id: string,
    opts: { lock?: boolean } = {},
  ): Promise<Drop> {
    const drop = await this.repo.findById(db, id, opts);
    if (!drop)
      throw new AppException(
        'NOT_FOUND',
        'Drop not found',
        HttpStatus.NOT_FOUND,
      );
    const [items, sold, dps, counts] = await Promise.all([
      this.repo.items(db, id),
      this.repo.soldQty(db, id),
      this.repo.deliveryPointsFor(db, id),
      this.repo.counts(db, [id]),
    ]);
    return {
      ...toListItem(drop, toCounts(counts.get(id), drop)),
      items: items.map((i) => toItemDto(i, sold.get(i.id) ?? 0)),
      delivery_points: dps.map((d) => ({
        id: d.id,
        name: d.name,
        area: d.area,
        is_active: d.isActive,
      })),
    };
  }

  // ---- create / update / duplicate -------------------------------------------

  async create(body: CreateDropBody): Promise<Drop> {
    const id = await this.repo.transaction(async (tx) => {
      await this.assertRefs(tx, body.restaurant_id, body.delivery_point_ids);
      const drop = await this.repo.insertDrop(tx, {
        restaurantId: body.restaurant_id,
        title: body.title,
        description: body.description ?? null,
        status: 'draft',
        cutoffAt: new Date(body.cutoff_at),
        deliveryStartsAt: new Date(body.delivery_starts_at),
        deliveryEndsAt: new Date(body.delivery_ends_at),
        minOrders: body.min_orders,
        maxOrders: body.max_orders,
        deliveryFeePaise: body.delivery_fee_paise ?? 0,
        customerNotes: body.customer_notes ?? null,
        internalNotes: body.internal_notes ?? null,
      });
      await this.repo.insertItems(
        tx,
        body.items.map((row, i) => itemInsert(drop.id, row, i)),
      );
      await this.repo.replaceDeliveryPoints(
        tx,
        drop.id,
        body.delivery_point_ids,
      );
      return drop.id;
    });
    return this.getById(id);
  }

  async update(id: string, body: UpdateDropBody): Promise<Drop> {
    await this.repo.transaction(async (tx) => {
      const current = await this.load(tx, id, { lock: true });
      const check = validateDropPatch(snapshotOf(current), body);
      if (!check.ok) {
        throw new AppException(
          'VALIDATION_ERROR',
          check.message,
          HttpStatus.BAD_REQUEST,
          [{ path: check.path ?? '', message: check.message }],
        );
      }
      if (
        body.restaurant_id !== undefined ||
        body.delivery_point_ids !== undefined
      ) {
        await this.assertRefs(
          tx,
          body.restaurant_id ?? current.restaurant_id,
          body.delivery_point_ids ?? [],
        );
      }

      const values: Parameters<DropsRepository['updateDrop']>[2] = {};
      if (body.restaurant_id !== undefined)
        values.restaurantId = body.restaurant_id;
      if (body.title !== undefined) values.title = body.title;
      if (body.description !== undefined) values.description = body.description;
      if (body.cutoff_at !== undefined)
        values.cutoffAt = new Date(body.cutoff_at);
      if (body.delivery_starts_at !== undefined)
        values.deliveryStartsAt = new Date(body.delivery_starts_at);
      if (body.delivery_ends_at !== undefined)
        values.deliveryEndsAt = new Date(body.delivery_ends_at);
      if (body.min_orders !== undefined) values.minOrders = body.min_orders;
      if (body.max_orders !== undefined) values.maxOrders = body.max_orders;
      if (body.delivery_fee_paise !== undefined)
        values.deliveryFeePaise = body.delivery_fee_paise;
      if (body.customer_notes !== undefined)
        values.customerNotes = body.customer_notes;
      if (body.internal_notes !== undefined)
        values.internalNotes = body.internal_notes;
      await this.repo.updateDrop(tx, id, values);

      if (body.delivery_point_ids !== undefined && current.status === 'draft') {
        await this.repo.replaceDeliveryPoints(tx, id, body.delivery_point_ids);
      }

      if (body.items !== undefined) {
        const mode = current.status === 'draft' ? 'all' : 'open';
        const keep = new Set<string>();
        const inserts: DropItemInsert[] = [];
        for (const [i, row] of body.items.entries()) {
          if (row.id) {
            keep.add(row.id);
            await this.repo.updateItem(tx, row.id, itemPatch(row, mode));
          } else {
            inserts.push(itemInsert(id, row, i));
          }
        }
        await this.repo.insertItems(tx, inserts);
        if (current.status === 'draft') {
          await this.repo.deleteItems(
            tx,
            current.items.map((i) => i.id).filter((iid) => !keep.has(iid)),
          );
        }
      }
    });
    return this.getById(id);
  }

  /**
   * §9.1 Duplicate: copies settings, items and delivery points into a new
   * draft. Dates are shifted forward by whole weeks until delivery is in the
   * future (the columns are NOT NULL, so "cleared" = next weekend).
   */
  async duplicate(id: string): Promise<Drop> {
    const source = await this.getById(id);
    const now = Date.now();
    let shift = 0;
    while (new Date(source.delivery_starts_at).getTime() + shift <= now)
      shift += WEEK_MS;
    const moved = (s: string) =>
      new Date(new Date(s).getTime() + shift).toISOString();
    return this.create({
      restaurant_id: source.restaurant_id,
      title: `${source.title} (copy)`,
      description: source.description,
      cutoff_at: moved(source.cutoff_at),
      delivery_starts_at: moved(source.delivery_starts_at),
      delivery_ends_at: moved(source.delivery_ends_at),
      min_orders: source.min_orders,
      max_orders: source.max_orders,
      delivery_fee_paise: source.delivery_fee_paise,
      customer_notes: source.customer_notes,
      internal_notes: source.internal_notes,
      delivery_point_ids: source.delivery_points.map((d) => d.id),
      items: source.items.map((i) => ({
        name: i.name,
        description: i.description,
        price_paise: i.price_paise,
        cost_price_paise: i.cost_price_paise,
        is_veg: i.is_veg,
        max_qty_per_order: i.max_qty_per_order,
        max_total_qty: i.max_total_qty,
        sort_order: i.sort_order,
        is_available: true,
      })),
    });
  }

  // ---- transitions (§5.1, §14.5–7, §14.13) ------------------------------------

  async transition(
    id: string,
    body: TransitionDropBody,
    actor: Actor,
  ): Promise<Drop> {
    const reason = body.reason?.trim() || undefined;
    await this.repo.transaction(async (tx) => {
      const current = await this.load(tx, id, { lock: true });
      const from = current.status;
      const to = body.to;
      if (!canTransitionDrop(from, to)) {
        throw invalid(`Cannot move a drop from ${from} to ${to}`);
      }

      if (to === 'open') {
        const pre = canPublishDrop({
          itemCount: current.items.length,
          deliveryPointCount: current.delivery_points.length,
          cutoffAt: new Date(current.cutoff_at),
          now: new Date(),
        });
        if (!pre.ok) throw invalid(pre.message);
        if ((await this.repo.countOpenDrops(tx, id)) > 0) {
          throw invalid(
            'Another drop is already open — only one drop can be open at a time',
          );
        }
      }

      if (to === 'confirmed') {
        const paid = current.counts.paid;
        if (
          !canConfirmDrop({
            paidCount: paid,
            minOrders: current.min_orders,
            overrideReason: reason,
          })
        ) {
          throw invalid(
            `Only ${paid} paid order(s) — minimum is ${current.min_orders}. Give an override reason to confirm anyway`,
          );
        }
      }

      if (to === 'cancelled' && !reason) {
        throw invalid('A reason is required to cancel a drop');
      }

      const now = new Date();
      const tsColumn = DROP_TRANSITION_TIMESTAMP[to];
      await this.repo.updateDrop(tx, id, {
        status: to,
        ...(tsColumn ? { [tsColumn]: now } : {}),
        ...(to === 'cancelled' ? { cancelReason: reason ?? null } : {}),
      });

      const who = actorLabel(actor, { admin: true });
      if (to === 'confirmed') {
        const override = current.counts.paid < current.min_orders;
        await this.events.log(
          {
            type: 'drop_confirmed',
            dropId: id,
            actor: who,
            meta: {
              paid: current.counts.paid,
              min_orders: current.min_orders,
              ...(override ? { override_reason: reason } : {}),
            },
          },
          tx,
        );
      }
      if (to === 'cancelled') {
        const cascade = await this.repo.cascadeCancelOrders(tx, id);
        await this.events.log(
          {
            type: 'drop_cancelled',
            dropId: id,
            actor: who,
            meta: { reason, from, ...cascade },
          },
          tx,
        );
        this.logger.log(
          `drop ${id} cancelled by ${who}: ${cascade.refundPending} → refund_pending, ${cascade.cancelled} → cancelled`,
        );
      }
    });
    return this.getById(id);
  }

  // ---- dashboard (§9.2, §13) -----------------------------------------------

  async dashboard(id: string): Promise<DropDashboard> {
    return this.repo.run(async (db) => {
      const drop = await this.repo.findById(db, id);
      if (!drop)
        throw new AppException(
          'NOT_FOUND',
          'Drop not found',
          HttpStatus.NOT_FOUND,
        );
      const [counts, money, funnel] = await Promise.all([
        this.repo.counts(db, [id]),
        this.repo.revenueAndCost(db, id),
        this.repo.funnel(db, id),
      ]);
      const funnelOut = Object.fromEntries(
        DROP_FUNNEL_STEPS.map((step) => [step, funnel.get(step) ?? 0]),
      ) as DropDashboard['funnel'];
      return {
        drop_id: id,
        counts: toCounts(counts.get(id), drop),
        revenue_paise: money.revenuePaise,
        estimated_margin_paise: money.missingCost
          ? null
          : money.revenuePaise - money.foodCostPaise,
        funnel: funnelOut,
      };
    });
  }

  // ---- helpers -------------------------------------------------------------

  private async assertRefs(
    db: DbOrTx,
    restaurantId: string,
    dpIds: string[],
  ): Promise<void> {
    if (!(await this.repo.restaurantExists(db, restaurantId))) {
      throw new AppException(
        'VALIDATION_ERROR',
        'Unknown restaurant',
        HttpStatus.BAD_REQUEST,
        [{ path: 'restaurant_id', message: 'Unknown restaurant' }],
      );
    }
    const existing = await this.repo.existingDeliveryPointIds(db, dpIds);
    const missing = dpIds.filter((d) => !existing.has(d));
    if (missing.length > 0) {
      throw new AppException(
        'VALIDATION_ERROR',
        'Unknown delivery point',
        HttpStatus.BAD_REQUEST,
        [
          {
            path: 'delivery_point_ids',
            message: `Unknown delivery point(s): ${missing.join(', ')}`,
          },
        ],
      );
    }
  }
}

function invalid(message: string): AppException {
  return new AppException('INVALID_TRANSITION', message, HttpStatus.CONFLICT);
}

function snapshotOf(d: Drop): DropSnapshot {
  return {
    status: d.status,
    restaurant_id: d.restaurant_id,
    title: d.title,
    description: d.description,
    cutoff_at: d.cutoff_at,
    delivery_starts_at: d.delivery_starts_at,
    delivery_ends_at: d.delivery_ends_at,
    min_orders: d.min_orders,
    max_orders: d.max_orders,
    delivery_fee_paise: d.delivery_fee_paise,
    customer_notes: d.customer_notes,
    internal_notes: d.internal_notes,
    delivery_point_ids: d.delivery_points.map((p) => p.id),
    items: d.items.map((i) => ({
      id: i.id,
      name: i.name,
      description: i.description,
      price_paise: i.price_paise,
      cost_price_paise: i.cost_price_paise,
      is_veg: i.is_veg,
      max_qty_per_order: i.max_qty_per_order,
      max_total_qty: i.max_total_qty,
      sort_order: i.sort_order,
      is_available: i.is_available,
      sold_qty: i.sold_qty,
    })),
    capacity_used: d.counts.capacity_used,
  };
}
