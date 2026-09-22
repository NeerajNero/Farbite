import {
  generateOrderCode,
  isValidOrderCode,
  ORDER_CODE_ALPHABET,
} from './order-code.js';
import { normalisePhone } from './phone.js';
import { validateUtr } from './utr.js';

describe('order code (§6)', () => {
  it('generates FB- + 4 chars from the safe alphabet', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateOrderCode();
      expect(code).toMatch(/^FB-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}$/);
      expect(isValidOrderCode(code)).toBe(true);
    }
  });
  it('alphabet excludes ambiguous chars 0/O/1/I/L', () => {
    for (const c of '0O1IL') expect(ORDER_CODE_ALPHABET).not.toContain(c);
  });
  it('is deterministic given an injected rng', () => {
    expect(generateOrderCode(() => 0)).toBe('FB-2222');
  });
  it('rejects bad codes', () => {
    expect(isValidOrderCode('WD-7K3M')).toBe(false);
    expect(isValidOrderCode('FB-7K3')).toBe(false);
    expect(isValidOrderCode('FB-7K30')).toBe(false); // 0 not in alphabet
  });
});

describe('phone normalisation (§14.11)', () => {
  it('accepts +91 / 91 / 0 prefixes and spaces, stores 10 digits', () => {
    expect(normalisePhone('+91 98765 43210')).toEqual({ ok: true, phone: '9876543210' });
    expect(normalisePhone('919876543210')).toEqual({ ok: true, phone: '9876543210' });
    expect(normalisePhone('09876543210')).toEqual({ ok: true, phone: '9876543210' });
    expect(normalisePhone('9876543210')).toEqual({ ok: true, phone: '9876543210' });
    expect(normalisePhone(' 98 76 54 32 10 ')).toEqual({ ok: true, phone: '9876543210' });
  });
  it('rejects anything else', () => {
    expect(normalisePhone('12345')).toEqual({ ok: false });
    expect(normalisePhone('98765432101')).toEqual({ ok: false });
    expect(normalisePhone('+1 555 123 4567')).toEqual({ ok: false });
    expect(normalisePhone('98765abcde')).toEqual({ ok: false });
    expect(normalisePhone('')).toEqual({ ok: false });
  });
});

describe('UTR validation (§14.9)', () => {
  it('accepts exactly 12 digits, stripping spaces', () => {
    expect(validateUtr('123456789012')).toEqual({ ok: true, utr: '123456789012' });
    expect(validateUtr(' 1234 5678 9012 ')).toEqual({ ok: true, utr: '123456789012' });
  });
  it('rejects wrong length or non-digits', () => {
    expect(validateUtr('12345678901')).toEqual({ ok: false });
    expect(validateUtr('1234567890123')).toEqual({ ok: false });
    expect(validateUtr('12345678901a')).toEqual({ ok: false });
    expect(validateUtr('')).toEqual({ ok: false });
  });
});
