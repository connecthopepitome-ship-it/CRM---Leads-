/** Money is always integer paise (RULE-035, NFR-020). */
export type Paise = number;

/** Round half-up (away from zero for positives) to an integer. */
export function roundHalfUp(n: number): number {
  // Guard against floating error such as 1.005 * 100 = 100.49999
  const eps = 1e-9;
  return n >= 0 ? Math.floor(n + 0.5 + eps) : -Math.floor(-n + 0.5 + eps);
}

/** "48380.00" — 2 decimals, no grouping (used in UPI payloads). */
export function toRupeeString(paise: Paise): string {
  const sign = paise < 0 ? '-' : '';
  const abs = Math.abs(paise);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

/** Indian digit grouping "₹12,34,567.00" (RULE-060). */
export function formatINR(paise: Paise, withSymbol = true): string {
  const sign = paise < 0 ? '-' : '';
  const abs = Math.abs(paise);
  const rupees = String(Math.floor(abs / 100));
  const last3 = rupees.slice(-3);
  const rest = rupees.slice(0, -3);
  const grouped = rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3 : last3;
  return `${sign}${withSymbol ? '₹' : ''}${grouped}.${String(abs % 100).padStart(2, '0')}`;
}

/** Parse "1,234.50" or "1234.5" into paise; returns null when invalid. */
export function parseRupees(input: string): Paise | null {
  const s = input.replace(/[₹,\s]/g, '');
  if (!/^-?\d+(\.\d{1,2})?$/.test(s)) return null;
  const [r, p = ''] = s.replace('-', '').split('.');
  const v = Number(r) * 100 + Number(p.padEnd(2, '0'));
  return s.startsWith('-') ? -v : v;
}
