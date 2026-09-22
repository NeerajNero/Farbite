// §14.9 / §11.2 — UTR: exactly 12 digits after stripping spaces. Global
// uniqueness across payments.upi_ref is enforced by the DB unique constraint.

export type UtrResult = { ok: true; utr: string } | { ok: false };

export function validateUtr(raw: string): UtrResult {
  const stripped = raw.replace(/\s+/g, '');
  return /^\d{12}$/.test(stripped) ? { ok: true, utr: stripped } : { ok: false };
}
