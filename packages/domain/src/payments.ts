import type { IsoDate } from './dates.js';
import type { Paise } from './money.js';

export interface OpenInvoice {
  id: string;
  number: string;
  date: IsoDate;
  dueDate: IsoDate;
  balance: Paise;
}
export interface Allocation {
  invoiceId: string;
  amount: Paise;
}
export interface AllocationPlan {
  allocations: Allocation[];
  advance: Paise;
}

/**
 * Oldest due date first (then date, then number); remainder kept as advance (RULE-044, RULE-045: cash + TDS).
 * `preferInvoiceId` (FR-070 AC1: opened from an invoice) is settled first, then the rest oldest-first (FR-071).
 */
export function autoAllocate(invoices: OpenInvoice[], total: Paise, preferInvoiceId?: string): AllocationPlan {
  const sorted = [...invoices].filter((i) => i.balance > 0).sort((a, b) =>
    (a.id === preferInvoiceId) !== (b.id === preferInvoiceId) ? (a.id === preferInvoiceId ? -1 : 1)
      : a.dueDate !== b.dueDate ? (a.dueDate < b.dueDate ? -1 : 1) : a.date !== b.date ? (a.date < b.date ? -1 : 1) : a.number.localeCompare(b.number));
  let remaining = total;
  const allocations: Allocation[] = [];
  for (const inv of sorted) {
    if (remaining <= 0) break;
    const amt = Math.min(inv.balance, remaining);
    allocations.push({ invoiceId: inv.id, amount: amt });
    remaining -= amt;
  }
  return { allocations, advance: remaining };
}

/** Manual allocations must not exceed the payment total nor any invoice balance (RULE-044). */
export function validateManual(invoices: OpenInvoice[], total: Paise, allocs: Allocation[]): { error: string; invoiceId?: string } | AllocationPlan {
  const sum = allocs.reduce((a, x) => a + x.amount, 0);
  if (allocs.some((a) => a.amount <= 0)) return { error: 'VALIDATION_FAILED' };
  if (sum > total) return { error: 'ALLOCATION_EXCEEDS_AMOUNT' };
  for (const a of allocs) {
    const inv = invoices.find((i) => i.id === a.invoiceId);
    if (!inv) return { error: 'NOT_FOUND', invoiceId: a.invoiceId };
    if (a.amount > inv.balance) return { error: 'ALLOCATION_EXCEEDS_BALANCE', invoiceId: a.invoiceId };
  }
  return { allocations: allocs, advance: total - sum };
}

export const PAYMENT_MODES = ['upi', 'neft', 'rtgs', 'imps', 'cheque', 'card', 'cash'] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number];
/** RULE-042 */
export function referenceRequired(mode: PaymentMode): boolean {
  return mode !== 'cash';
}
export function normaliseRef(ref: string): string {
  return ref.replace(/\s+/g, '').toUpperCase();
}
