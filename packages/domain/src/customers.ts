import type { IsoDate } from './dates.js';
import type { Paise } from './money.js';

export const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
export const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

/** RULE-016: pattern and state code match. */
export function validateGstin(gstin: string, stateCode?: string | null): string | null {
  if (!GSTIN_PATTERN.test(gstin)) return 'GSTIN_INVALID';
  if (stateCode && gstin.slice(0, 2) !== stateCode) return 'GSTIN_STATE_MISMATCH';
  return null;
}

export interface LedgerEntry {
  date: IsoDate;
  seq: number; // tiebreaker (createdAt ms)
  kind: 'invoice' | 'credit_note' | 'payment' | 'tds' | 'reversal' | 'advance_applied' | 'opening';
  docNumber: string;
  debit: Paise;
  credit: Paise;
}
export interface StatementRow extends LedgerEntry {
  balance: Paise;
}

/** FR-076: opening = net of entries before `from`; running and closing balance. */
export function buildStatement(entries: LedgerEntry[], from: IsoDate, to: IsoDate) {
  const sorted = [...entries].sort((a, b) => (a.date !== b.date ? (a.date < b.date ? -1 : 1) : a.seq - b.seq));
  let opening = 0;
  for (const e of sorted) if (e.date < from) opening += e.debit - e.credit;
  let bal = opening;
  const rows: StatementRow[] = [];
  let debits = 0;
  let credits = 0;
  for (const e of sorted) {
    if (e.date < from || e.date > to) continue;
    bal += e.debit - e.credit;
    debits += e.debit;
    credits += e.credit;
    rows.push({ ...e, balance: bal });
  }
  return { from, to, opening, rows, debits, credits, closing: bal };
}
