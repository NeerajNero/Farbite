// All DB timestamps are timestamptz UTC; all display is Asia/Kolkata (PLAN.md §0.13).

const IST_TIME_ZONE = 'Asia/Kolkata';

/** Format a Date (or ISO string) in IST, e.g. "Sat 4 Oct, 9:00 pm". */
export function toIST(
  value: Date | string,
  options: Intl.DateTimeFormatOptions = {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  },
): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) {
    throw new TypeError(`toIST received an invalid date: ${String(value)}`);
  }
  return new Intl.DateTimeFormat('en-IN', { ...options, timeZone: IST_TIME_ZONE }).format(date);
}

const IST_OFFSET_MINUTES = 330;

/**
 * Convert an IST wall-clock value from `<input type="datetime-local">`
 * ("YYYY-MM-DDTHH:mm") to a UTC ISO string. Returns null for malformed input.
 */
export function istLocalToIso(local: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(local)) return null;
  const date = new Date(`${local}+05:30`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** Inverse of istLocalToIso: UTC instant → "YYYY-MM-DDTHH:mm" in IST. */
export function isoToIstLocal(value: Date | string): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) {
    throw new TypeError(`isoToIstLocal received an invalid date: ${String(value)}`);
  }
  const shifted = new Date(date.getTime() + IST_OFFSET_MINUTES * 60_000);
  return shifted.toISOString().slice(0, 16);
}
