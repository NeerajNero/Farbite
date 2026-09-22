// Money is always integer paise (PLAN.md §0.7). These helpers are the only
// place paise↔display conversion happens.

/** Format integer paise as a rupee string: 12300 → "₹123", 12350 → "₹123.50". */
export function formatPaise(paise: number): string {
  if (!Number.isInteger(paise)) {
    throw new TypeError(`formatPaise expects integer paise, got ${paise}`);
  }
  const sign = paise < 0 ? '-' : '';
  const abs = Math.abs(paise);
  const rupees = Math.floor(abs / 100);
  const rest = abs % 100;
  const rupeesStr = rupees.toLocaleString('en-IN');
  return rest === 0
    ? `${sign}₹${rupeesStr}`
    : `${sign}₹${rupeesStr}.${String(rest).padStart(2, '0')}`;
}

/** Rupee amount for UPI deep links (`am=` param): 12350 → "123.50", 12300 → "123". */
export function paiseToUpiAmount(paise: number): string {
  if (!Number.isInteger(paise) || paise < 0) {
    throw new TypeError(`paiseToUpiAmount expects non-negative integer paise, got ${paise}`);
  }
  const rupees = Math.floor(paise / 100);
  const rest = paise % 100;
  return rest === 0 ? String(rupees) : `${rupees}.${String(rest).padStart(2, '0')}`;
}
