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
