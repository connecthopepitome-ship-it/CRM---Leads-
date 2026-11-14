import { parseIsoDate, type IsoDate } from './dates.js';

/** Financial year code "25-26" for a document date (FY runs 1 April – 31 March, RULE-003, RULE-061). */
export function fyOf(date: IsoDate): string {
  const { y, m } = parseIsoDate(date);
  const start = m >= 4 ? y : y - 1;
  return `${String(start % 100).padStart(2, '0')}-${String((start + 1) % 100).padStart(2, '0')}`;
}

export interface SeriesFormat {
  prefix: string;
  pad: number;
  fyReset: boolean;
}

const ALLOWED = /^[A-Za-z0-9/-]+$/;

/** `{prefix}/{FY}/{padded seq}` — or `{prefix}/{seq}` when FY reset is off. */
export function formatDocNumber(s: SeriesFormat, fy: string, seq: number): string {
  const n = String(seq).padStart(s.pad, '0');
  return s.fyReset ? `${s.prefix}/${fy}/${n}` : `${s.prefix}/${n}`;
}

/** A series is valid only if its longest possible number fits in 16 chars of letters, digits, / and - (CGST Rule 46). */
export function validateSeries(s: SeriesFormat): string | null {
  if (!s.prefix || !ALLOWED.test(s.prefix)) return 'SERIES_INVALID_CHARS';
  const longest = formatDocNumber(s, '99-00', Number('9'.repeat(Math.max(s.pad, 1))));
  if (longest.length > 16) return 'SERIES_TOO_LONG';
  return null;
}

/** Counter key per document type and FY. */
export function counterKey(docType: string, s: SeriesFormat, fy: string): string {
  return s.fyReset ? `${docType}-${fy}` : docType;
}

/** UPI `tr` reference: prefix + FY digits without separator + '-' + sequence. `INV/25-26/0142` → `INV2526-0142` (RULE-041). */
export function upiTrRef(docNumber: string): string {
  const parts = docNumber.split('/');
  if (parts.length === 3) return `${parts[0]}${(parts[1] ?? '').replace(/-/g, '')}-${parts[2]}`;
  return docNumber.replace(/\//g, '-');
}
