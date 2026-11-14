import { addDays, daysBetween, type IsoDate } from './dates.js';
import type { Paise } from './money.js';

// ---- Discount approval (RULE-027) ----
export interface ApprovalCheck {
  mode: 'solo' | 'team';
  maxDiscountPct: number;
  roleLimitPct: number;
  approvedMaxPct?: number | null;
}
export function needsApproval(c: ApprovalCheck): boolean {
  if (c.mode === 'solo') return false;
  const epsilon = 1e-9;
  if (c.maxDiscountPct <= c.roleLimitPct + epsilon) return false;
  if (c.approvedMaxPct != null && c.maxDiscountPct <= c.approvedMaxPct + epsilon) return false;
  return true;
}

// ---- Quote state machine (LLD-sales §7) ----
export const QUOTE_TRANSITIONS: Record<string, string[]> = {
  draft: ['pending_approval', 'sent'],
  pending_approval: ['approved', 'draft'],
  approved: ['sent', 'draft'],
  sent: ['viewed', 'accepted', 'changes_requested', 'rejected', 'expired', 'superseded'],
  viewed: ['accepted', 'changes_requested', 'rejected', 'expired', 'superseded'],
  changes_requested: ['superseded', 'expired'],
  accepted: [],
  rejected: ['superseded'],
  expired: ['superseded'],
  superseded: [],
};
export function canQuoteTransition(from: string, to: string): boolean {
  return QUOTE_TRANSITIONS[from]?.includes(to) ?? false;
}
export const QUOTE_EDITABLE = ['draft', 'approved', 'pending_approval'];
/** RULE-030: only the latest, unexpired, sent/viewed revision can be accepted. */
export function canAccept(q: { status: string; isLatest: boolean; validUntil: IsoDate }, today: IsoDate): boolean {
  return q.isLatest && ['sent', 'viewed'].includes(q.status) && today <= q.validUntil;
}

// ---- Orders (RULE-032) ----
export const ORDER_TRANSITIONS: Record<string, string[]> = {
  confirmed: ['in_progress', 'on_hold', 'delivered', 'cancelled'],
  in_progress: ['delivered', 'on_hold', 'cancelled'],
  on_hold: ['confirmed', 'in_progress', 'cancelled'],
  delivered: ['closed', 'in_progress'],
  closed: [],
  cancelled: [],
};
export function canOrderTransition(from: string, to: string): boolean {
  return ORDER_TRANSITIONS[from]?.includes(to) ?? false;
}

// ---- Invoicing (RULE-033, RULE-039, RULE-040) ----
export function pendingQty(line: { qty: number; invoicedQty: number; creditedQty: number }): number {
  return Math.max(0, round3(line.qty - (line.invoicedQty - line.creditedQty)));
}
const round3 = (n: number) => Math.round(n * 1000) / 1000;

export function dueDate(invoiceDate: IsoDate, termDays: number): IsoDate {
  return addDays(invoiceDate, termDays);
}

export type AgeingBucket = 'not_due' | 'd1_30' | 'd31_60' | 'd61_90' | 'd90_plus';
export function ageingBucket(due: IsoDate, asOf: IsoDate): AgeingBucket {
  const d = daysBetween(due, asOf);
  if (d <= 0) return 'not_due';
  if (d <= 30) return 'd1_30';
  if (d <= 60) return 'd31_60';
  if (d <= 90) return 'd61_90';
  return 'd90_plus';
}

export function isOverdue(due: IsoDate, today: IsoDate, balance: Paise): boolean {
  return balance > 0 && today > due;
}

/** Balance due = grand total − allocated payments (cash + TDS) − credit notes (RULE-040). */
export function balanceDue(i: { grandTotal: Paise; paid: Paise; credited: Paise }): Paise {
  return Math.max(0, i.grandTotal - i.paid - i.credited);
}

export function invoiceStatus(i: { grandTotal: Paise; paid: Paise; credited: Paise }): 'issued' | 'partly_paid' | 'paid' | 'cancelled' {
  if (i.credited >= i.grandTotal && i.grandTotal > 0) return 'cancelled';
  const bal = balanceDue(i);
  if (bal === 0) return 'paid';
  return i.paid > 0 || i.credited > 0 ? 'partly_paid' : 'issued';
}

/** Credit note limit and on-account credit (RULE-038). */
export function creditNoteEffect(i: { grandTotal: Paise; paid: Paise; credited: Paise }, amount: Paise): { ok: boolean; onAccount: Paise } {
  if (amount <= 0 || i.credited + amount > i.grandTotal) return { ok: false, onAccount: 0 };
  const balance = balanceDue(i);
  return { ok: true, onAccount: Math.max(0, amount - balance) };
}

export const HSN_PATTERN = /^\d{4}(\d{2})?(\d{2})?$/;
export const SAC_PATTERN = /^\d{6}$/;
