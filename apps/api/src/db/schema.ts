// Drizzle schema — mirrors PLAN.md §6 exactly. Enum VALUES come from
// @farbite/shared (single source of truth); pgEnum needs a non-empty tuple, so
// we spread with the first element pinned.
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import {
  DROP_STATUSES,
  ORDER_STATUSES,
  PAYMENT_PROVIDERS,
  PAYMENT_STATUSES,
} from '@farbite/shared';

export const dropStatusEnum = pgEnum('drop_status', [DROP_STATUSES[0], ...DROP_STATUSES.slice(1)]);
export const orderStatusEnum = pgEnum('order_status', [
  ORDER_STATUSES[0],
  ...ORDER_STATUSES.slice(1),
]);
export const paymentProviderEnum = pgEnum('payment_provider', [
  PAYMENT_PROVIDERS[0],
  ...PAYMENT_PROVIDERS.slice(1),
]);
export const paymentStatusEnum = pgEnum('payment_status', [
  PAYMENT_STATUSES[0],
  ...PAYMENT_STATUSES.slice(1),
]);

const id = () => uuid('id').primaryKey().defaultRandom();
const createdAt = () => timestamp('created_at', { withTimezone: true }).defaultNow().notNull();
const updatedAt = () => timestamp('updated_at', { withTimezone: true });
const tstz = (name: string) => timestamp(name, { withTimezone: true });

export const users = pgTable('users', {
  id: id(),
  email: text('email').unique().notNull(),
  name: text('name'),
  image: text('image'),
  phone: text('phone'),
  defaultDeliveryPointId: uuid('default_delivery_point_id').references(() => deliveryPoints.id),
  isAdmin: boolean('is_admin').default(false).notNull(),
  lastLoginAt: tstz('last_login_at'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const restaurants = pgTable('restaurants', {
  id: id(),
  name: text('name').notNull(),
  area: text('area'),
  address: text('address'),
  phone: text('phone'),
  notes: text('notes'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const deliveryPoints = pgTable('delivery_points', {
  id: id(),
  name: text('name').notNull(),
  area: text('area'),
  landmark: text('landmark'),
  handoverNotes: text('handover_notes'),
  sortOrder: integer('sort_order').default(0).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const drops = pgTable('drops', {
  id: id(),
  restaurantId: uuid('restaurant_id')
    .references(() => restaurants.id)
    .notNull(),
  title: text('title').notNull(),
  description: text('description'),
  status: dropStatusEnum('status').default('draft').notNull(),
  cutoffAt: tstz('cutoff_at').notNull(),
  deliveryStartsAt: tstz('delivery_starts_at').notNull(),
  deliveryEndsAt: tstz('delivery_ends_at').notNull(),
  minOrders: integer('min_orders').notNull(),
  maxOrders: integer('max_orders').notNull(),
  deliveryFeePaise: integer('delivery_fee_paise').default(0).notNull(),
  customerNotes: text('customer_notes'),
  internalNotes: text('internal_notes'),
  openedAt: tstz('opened_at'),
  closedAt: tstz('closed_at'),
  confirmedAt: tstz('confirmed_at'),
  outForDeliveryAt: tstz('out_for_delivery_at'),
  deliveredAt: tstz('delivered_at'),
  cancelledAt: tstz('cancelled_at'),
  cancelReason: text('cancel_reason'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const dropItems = pgTable('drop_items', {
  id: id(),
  dropId: uuid('drop_id')
    .references(() => drops.id, { onDelete: 'cascade' })
    .notNull(),
  name: text('name').notNull(),
  description: text('description'),
  pricePaise: integer('price_paise').notNull(),
  costPricePaise: integer('cost_price_paise'),
  isVeg: boolean('is_veg').default(true).notNull(),
  maxQtyPerOrder: integer('max_qty_per_order').default(5).notNull(),
  maxTotalQty: integer('max_total_qty'),
  sortOrder: integer('sort_order').default(0).notNull(),
  isAvailable: boolean('is_available').default(true).notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const dropDeliveryPoints = pgTable(
  'drop_delivery_points',
  {
    dropId: uuid('drop_id')
      .references(() => drops.id)
      .notNull(),
    deliveryPointId: uuid('delivery_point_id')
      .references(() => deliveryPoints.id)
      .notNull(),
  },
  (t) => [primaryKey({ columns: [t.dropId, t.deliveryPointId] })],
);

export const orders = pgTable(
  'orders',
  {
    id: id(),
    code: text('code').unique().notNull(),
    accessToken: text('access_token').unique().notNull(),
    idempotencyKey: text('idempotency_key').unique(),
    dropId: uuid('drop_id')
      .references(() => drops.id)
      .notNull(),
    userId: uuid('user_id').references(() => users.id),
    deliveryPointId: uuid('delivery_point_id')
      .references(() => deliveryPoints.id)
      .notNull(),
    customerName: text('customer_name').notNull(),
    customerPhone: text('customer_phone').notNull(),
    customerNote: text('customer_note'),
    refundUpiId: text('refund_upi_id'),
    status: orderStatusEnum('status').default('pending_payment').notNull(),
    subtotalPaise: integer('subtotal_paise').notNull(),
    deliveryFeePaise: integer('delivery_fee_paise').notNull(),
    totalPaise: integer('total_paise').notNull(),
    expiresAt: tstz('expires_at').notNull(),
    paidAt: tstz('paid_at'),
    deliveredAt: tstz('delivered_at'),
    cancelledAt: tstz('cancelled_at'),
    refundedAt: tstz('refunded_at'),
    clientIp: text('client_ip'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('orders_drop_id_status_idx').on(t.dropId, t.status),
    index('orders_customer_phone_idx').on(t.customerPhone),
    index('orders_user_id_idx').on(t.userId),
  ],
);

export const orderItems = pgTable(
  'order_items',
  {
    id: id(),
    orderId: uuid('order_id')
      .references(() => orders.id, { onDelete: 'cascade' })
      .notNull(),
    dropItemId: uuid('drop_item_id')
      .references(() => dropItems.id)
      .notNull(),
    nameSnapshot: text('name_snapshot').notNull(),
    unitPricePaise: integer('unit_price_paise').notNull(),
    qty: integer('qty').notNull(),
    lineTotalPaise: integer('line_total_paise').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [check('order_items_qty_positive', sql`${t.qty} > 0`)],
);

export const payments = pgTable('payments', {
  id: id(),
  orderId: uuid('order_id')
    .references(() => orders.id)
    .notNull(),
  provider: paymentProviderEnum('provider').notNull(),
  status: paymentStatusEnum('status').notNull(),
  amountPaise: integer('amount_paise').notNull(),
  upiRef: text('upi_ref').unique(),
  submittedAt: tstz('submitted_at'),
  verifiedAt: tstz('verified_at'),
  rejectedAt: tstz('rejected_at'),
  refundedAt: tstz('refunded_at'),
  verifiedByUserId: uuid('verified_by_user_id').references(() => users.id),
  rejectionReason: text('rejection_reason'),
  refundRef: text('refund_ref'),
  providerOrderId: text('provider_order_id'),
  providerPaymentId: text('provider_payment_id'),
  providerRefundId: text('provider_refund_id'),
  rawPayload: jsonb('raw_payload'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const events = pgTable(
  'events',
  {
    id: id(),
    type: text('type').notNull(),
    dropId: uuid('drop_id'),
    orderId: uuid('order_id'),
    actor: text('actor'),
    meta: jsonb('meta'),
    createdAt: createdAt(),
  },
  (t) => [index('events_drop_id_type_idx').on(t.dropId, t.type)],
);
