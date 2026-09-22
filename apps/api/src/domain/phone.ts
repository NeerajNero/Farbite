// §14.11 — accept +91 / 91 / 0 prefixes and spaces; store 10 digits; reject
// anything else.

export type PhoneResult = { ok: true; phone: string } | { ok: false };

export function normalisePhone(raw: string): PhoneResult {
  const stripped = raw.replace(/\s+/g, '');
  let digits: string;
  if (stripped.startsWith('+91')) digits = stripped.slice(3);
  else if (/^91\d{10}$/.test(stripped)) digits = stripped.slice(2);
  else if (/^0\d{10}$/.test(stripped)) digits = stripped.slice(1);
  else digits = stripped;

  return /^\d{10}$/.test(digits) ? { ok: true, phone: digits } : { ok: false };
}
