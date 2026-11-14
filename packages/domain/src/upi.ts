import { toRupeeString, type Paise } from './money.js';
import { upiTrRef } from './numbering.js';

export interface UpiInput {
  vpa: string;
  payeeName: string;
  amount: Paise;
  docNumber: string;
  trEnabled: boolean;
}

/** NPCI deep link (RULE-041): upi://pay?pa=&pn=&am=&cu=INR&tn=&tr= */
export function buildUpiUri(i: UpiInput): string {
  const pn = encodeURIComponent(i.payeeName.slice(0, 50));
  const parts = [
    `pa=${i.vpa}`,
    `pn=${pn}`,
    `am=${toRupeeString(i.amount)}`,
    'cu=INR',
    `tn=${encodeURIComponent(i.docNumber)}`,
  ];
  if (i.trEnabled) parts.push(`tr=${encodeURIComponent(upiTrRef(i.docNumber))}`);
  return `upi://pay?${parts.join('&')}`;
}

export const VPA_PATTERN = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9.-]{1,63}$/;

/** What the payment block shows (FR-068 AC3/AC4). */
export function paymentBlockMode(balance: Paise, hasVpa: boolean, hasBank: boolean): 'paid' | 'qr' | 'bank' | 'none' {
  if (balance <= 0) return 'paid';
  if (hasVpa) return 'qr';
  return hasBank ? 'bank' : 'none';
}
