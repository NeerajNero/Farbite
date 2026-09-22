// §14.4 — totals are computed server-side from drop_items at placement; client
// totals are ignored. Integer paise only (§0.7).

export interface TotalsLine {
  unitPricePaise: number;
  qty: number;
}

export interface Totals {
  lineTotalsPaise: number[];
  subtotalPaise: number;
  deliveryFeePaise: number;
  totalPaise: number;
}

export function computeTotals(items: TotalsLine[], deliveryFeePaise: number): Totals {
  if (items.length === 0) throw new RangeError('order must contain at least one item');
  assertPaise(deliveryFeePaise, 'deliveryFeePaise');

  const lineTotalsPaise = items.map((item, i) => {
    assertPaise(item.unitPricePaise, `items[${i}].unitPricePaise`);
    if (!Number.isInteger(item.qty) || item.qty <= 0) {
      throw new RangeError(`items[${i}].qty must be a positive integer`);
    }
    return item.unitPricePaise * item.qty;
  });

  const subtotalPaise = lineTotalsPaise.reduce((sum, l) => sum + l, 0);
  return {
    lineTotalsPaise,
    subtotalPaise,
    deliveryFeePaise,
    totalPaise: subtotalPaise + deliveryFeePaise,
  };
}

function assertPaise(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative integer (paise)`);
  }
}
