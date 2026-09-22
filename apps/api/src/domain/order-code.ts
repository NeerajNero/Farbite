// §6 — order code: FB- + 4 chars from an ambiguity-free alphabet (no 0/O/1/I/L).
// Caller retries on unique-violation.

export const ORDER_CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export const ORDER_CODE_PREFIX = 'FB-';
const CODE_LENGTH = 4;

/** rng is injectable for tests; defaults to Math.random. */
export function generateOrderCode(rng: () => number = Math.random): string {
  let suffix = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    const idx = Math.floor(rng() * ORDER_CODE_ALPHABET.length);
    suffix += ORDER_CODE_ALPHABET[idx];
  }
  return `${ORDER_CODE_PREFIX}${suffix}`;
}

export function isValidOrderCode(code: string): boolean {
  if (!code.startsWith(ORDER_CODE_PREFIX)) return false;
  const suffix = code.slice(ORDER_CODE_PREFIX.length);
  return (
    suffix.length === CODE_LENGTH &&
    suffix.split('').every((c) => ORDER_CODE_ALPHABET.includes(c))
  );
}
