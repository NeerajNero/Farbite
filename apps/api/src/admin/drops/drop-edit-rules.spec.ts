import {
  canPublishDrop,
  validateDropPatch,
  type DropSnapshot,
} from './drop-edit-rules.js';

const item = (over: Partial<DropSnapshot['items'][number]> = {}) => ({
  id: 'i1',
  name: 'Biryani',
  description: null,
  price_paise: 30000,
  cost_price_paise: null,
  is_veg: false,
  max_qty_per_order: 5,
  max_total_qty: null,
  sort_order: 0,
  is_available: true,
  sold_qty: 3,
  ...over,
});

const snapshot = (over: Partial<DropSnapshot> = {}): DropSnapshot => ({
  status: 'open',
  restaurant_id: 'r1',
  title: 'T',
  description: null,
  cutoff_at: '2026-10-02T15:30:00.000Z',
  delivery_starts_at: '2026-10-03T07:30:00.000Z',
  delivery_ends_at: '2026-10-03T09:00:00.000Z',
  min_orders: 10,
  max_orders: 40,
  delivery_fee_paise: 2000,
  customer_notes: null,
  internal_notes: null,
  delivery_point_ids: ['d1', 'd2'],
  items: [item()],
  capacity_used: 7,
  ...over,
});

describe('validateDropPatch (§9.1)', () => {
  it('draft: everything is editable', () => {
    const r = validateDropPatch(snapshot({ status: 'draft' }), {
      title: 'New',
      items: [{ name: 'X', price_paise: 1 }],
      delivery_point_ids: [],
    });
    expect(r).toEqual({ ok: true });
  });

  it('draft: rejects item ids from another drop', () => {
    const r = validateDropPatch(snapshot({ status: 'draft' }), {
      items: [{ id: 'other', name: 'X', price_paise: 1 }],
    });
    expect(r.ok).toBe(false);
  });

  it('open: allows description, notes, max_orders ≥ used, later cutoff', () => {
    const r = validateDropPatch(snapshot(), {
      description: 'hi',
      customer_notes: 'n',
      internal_notes: 'i',
      max_orders: 7,
      cutoff_at: '2026-10-02T16:00:00.000Z',
    });
    expect(r).toEqual({ ok: true });
  });

  it('open: rejects max_orders below capacity used', () => {
    const r = validateDropPatch(snapshot(), { max_orders: 6 });
    expect(r).toMatchObject({ ok: false, path: 'max_orders' });
  });

  it('open: rejects earlier cutoff', () => {
    const r = validateDropPatch(snapshot(), {
      cutoff_at: '2026-10-02T15:00:00.000Z',
    });
    expect(r).toMatchObject({ ok: false, path: 'cutoff_at' });
  });

  it('open: unchanged values for locked fields are fine', () => {
    const r = validateDropPatch(snapshot(), {
      title: 'T',
      delivery_fee_paise: 2000,
      delivery_point_ids: ['d2', 'd1'],
      cutoff_at: '2026-10-02T15:30:00Z',
    });
    expect(r).toEqual({ ok: true });
  });

  it('open: rejects title / fee / delivery point changes', () => {
    expect(validateDropPatch(snapshot(), { title: 'x' })).toMatchObject({
      ok: false,
      path: 'title',
    });
    expect(
      validateDropPatch(snapshot(), { delivery_fee_paise: 0 }),
    ).toMatchObject({ ok: false });
    expect(
      validateDropPatch(snapshot(), { delivery_point_ids: ['d1'] }),
    ).toMatchObject({
      ok: false,
      path: 'delivery_point_ids',
    });
  });

  it('open: item availability + max_total_qty ≥ sold are allowed', () => {
    const r = validateDropPatch(snapshot(), {
      items: [
        {
          id: 'i1',
          name: 'Biryani',
          price_paise: 30000,
          is_available: false,
          max_total_qty: 3,
        },
      ],
    });
    expect(r).toEqual({ ok: true });
  });

  it('open: rejects max_total_qty below sold', () => {
    const r = validateDropPatch(snapshot(), {
      items: [
        { id: 'i1', name: 'Biryani', price_paise: 30000, max_total_qty: 2 },
      ],
    });
    expect(r).toMatchObject({ ok: false, path: 'items.0.max_total_qty' });
  });

  it('open: rejects price change, new items, removed items', () => {
    expect(
      validateDropPatch(snapshot(), {
        items: [{ id: 'i1', name: 'Biryani', price_paise: 31000 }],
      }),
    ).toMatchObject({ ok: false, path: 'items.0.price_paise' });
    expect(
      validateDropPatch(snapshot(), {
        items: [
          { id: 'i1', name: 'Biryani', price_paise: 30000 },
          { name: 'New', price_paise: 100 },
        ],
      }),
    ).toMatchObject({ ok: false, path: 'items.1' });
    expect(validateDropPatch(snapshot(), { items: [] })).toMatchObject({
      ok: false,
      path: 'items',
    });
  });

  it('closed+: only notes are editable', () => {
    for (const status of [
      'closed',
      'confirmed',
      'out_for_delivery',
      'delivered',
      'cancelled',
    ] as const) {
      expect(
        validateDropPatch(snapshot({ status }), {
          customer_notes: 'a',
          internal_notes: 'b',
        }),
      ).toEqual({
        ok: true,
      });
      expect(
        validateDropPatch(snapshot({ status }), { description: 'x' }),
      ).toMatchObject({ ok: false });
      expect(
        validateDropPatch(snapshot({ status }), { max_orders: 100 }),
      ).toMatchObject({ ok: false });
      expect(
        validateDropPatch(snapshot({ status }), {
          items: [
            {
              id: 'i1',
              name: 'Biryani',
              price_paise: 30000,
              is_available: false,
            },
          ],
        }),
      ).toMatchObject({ ok: false });
    }
  });
});

describe('canPublishDrop', () => {
  const now = new Date('2026-10-01T00:00:00Z');
  it('requires items, delivery points and a future cutoff', () => {
    const future = new Date('2026-10-02T00:00:00Z');
    expect(
      canPublishDrop({
        itemCount: 1,
        deliveryPointCount: 1,
        cutoffAt: future,
        now,
      }),
    ).toEqual({ ok: true });
    expect(
      canPublishDrop({
        itemCount: 0,
        deliveryPointCount: 1,
        cutoffAt: future,
        now,
      }).ok,
    ).toBe(false);
    expect(
      canPublishDrop({
        itemCount: 1,
        deliveryPointCount: 0,
        cutoffAt: future,
        now,
      }).ok,
    ).toBe(false);
    expect(
      canPublishDrop({
        itemCount: 1,
        deliveryPointCount: 1,
        cutoffAt: now,
        now,
      }).ok,
    ).toBe(false);
  });
});
