import { parsePhoneNumberFromString } from 'libphonenumber-js/min';

export interface NormalisedPhone {
  e164: string | null;
  raw: string;
  valid: boolean;
}

/** E.164 with default country India; invalid numbers are kept raw and flagged (RULE-019, FR-028). */
export function normalisePhone(raw: string | null | undefined): NormalisedPhone | null {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  const p = parsePhoneNumberFromString(trimmed, 'IN');
  if (p && p.isValid()) return { e164: p.number, raw: trimmed, valid: true };
  return { e164: null, raw: trimmed, valid: false };
}

export function normaliseEmail(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const e = String(raw).trim().toLowerCase();
  return e || null;
}

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidEmail(e: string | null | undefined): boolean {
  return !!e && EMAIL_PATTERN.test(e);
}

/** wa.me needs digits without "+". */
export function waDigits(e164: string): string {
  return e164.replace(/\D/g, '');
}
