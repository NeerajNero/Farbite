import { computeTotals } from './compute-totals.js';

describe('computeTotals (§14.4)', () => {
  it('computes line totals, subtotal, and total with delivery fee', () => {
    const t = computeTotals(
      [
        { unitPricePaise: 26000, qty: 2 },
        { unitPricePaise: 8000, qty: 1 },
      ],
      2000,
    );
    expect(t.lineTotalsPaise).toEqual([52000, 8000]);
    expect(t.subtotalPaise).toBe(60000);
    expect(t.deliveryFeePaise).toBe(2000);
    expect(t.totalPaise).toBe(62000);
  });

  it('rejects empty orders', () => {
    expect(() => computeTotals([], 0)).toThrow(RangeError);
  });

  it('rejects non-integer paise and non-positive qty', () => {
    expect(() => computeTotals([{ unitPricePaise: 100.5, qty: 1 }], 0)).toThrow(RangeError);
    expect(() => computeTotals([{ unitPricePaise: 100, qty: 0 }], 0)).toThrow(RangeError);
    expect(() => computeTotals([{ unitPricePaise: 100, qty: -2 }], 0)).toThrow(RangeError);
    expect(() => computeTotals([{ unitPricePaise: 100, qty: 1.5 }], 0)).toThrow(RangeError);
    expect(() => computeTotals([{ unitPricePaise: 100, qty: 1 }], -1)).toThrow(RangeError);
  });
});
