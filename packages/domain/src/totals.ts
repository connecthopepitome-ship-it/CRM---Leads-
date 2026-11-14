import { roundHalfUp, type Paise } from './money.js';
import { amountInWords } from './words.js';

export interface LineInput {
  kind?: 'item' | 'heading';
  description?: string;
  qty: number;
  rate: Paise;
  discountPct?: number | null;
  discountAmt?: Paise | null;
  taxRatePct: number;
  hsnSac?: string | null;
}

export interface LineResult {
  gross: Paise;
  discount: Paise;
  taxable: Paise;
  cgst: Paise;
  sgst: Paise;
  igst: Paise;
  total: Paise;
}

export interface DocContext {
  gst: boolean; // GST-registered install and not a bill of supply
  intraState: boolean;
  overallDiscountPct?: number;
  roundOff: boolean;
}

export interface DocTotals {
  subTotal: Paise;
  discountTotal: Paise;
  taxable: Paise;
  cgst: Paise;
  sgst: Paise;
  igst: Paise;
  taxTotal: Paise;
  roundOff: Paise;
  grandTotal: Paise;
  inWords: string;
  taxByRate: { ratePct: number; taxable: Paise; cgst: Paise; sgst: Paise; igst: Paise }[];
  maxDiscountPct: number;
}

/** One line (RULE-035): gross = qty × rate; discount; taxable; tax per line rounded half-up. */
export function computeLine(l: LineInput, ctx: DocContext): LineResult {
  if (l.kind === 'heading') return { gross: 0, discount: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 };
  const gross = roundHalfUp(l.qty * l.rate);
  const lineDisc = l.discountAmt != null ? l.discountAmt : roundHalfUp((gross * (l.discountPct ?? 0)) / 100);
  if (lineDisc < 0 || lineDisc > gross) throw new RangeError('DISCOUNT_EXCEEDS_GROSS');
  const overall = ctx.overallDiscountPct ? roundHalfUp(((gross - lineDisc) * ctx.overallDiscountPct) / 100) : 0;
  const discount = lineDisc + overall;
  const taxable = gross - discount;
  let cgst = 0;
  let sgst = 0;
  let igst = 0;
  if (ctx.gst && l.taxRatePct > 0) {
    if (ctx.intraState) {
      cgst = roundHalfUp((taxable * l.taxRatePct) / 200);
      sgst = cgst;
    } else {
      igst = roundHalfUp((taxable * l.taxRatePct) / 100);
    }
  }
  return { gross, discount, taxable, cgst, sgst, igst, total: taxable + cgst + sgst + igst };
}

/** Effective discount % of a line, for approval checks (RULE-027). */
export function lineDiscountPct(l: LineInput): number {
  if (l.kind === 'heading') return 0;
  const gross = roundHalfUp(l.qty * l.rate);
  if (gross === 0) return 0;
  const d = l.discountAmt != null ? l.discountAmt : (gross * (l.discountPct ?? 0)) / 100;
  return (d / gross) * 100;
}

/** Document totals incl. tax summary, round-off to nearest rupee and words (FR-052). */
export function computeDocument(lines: LineInput[], ctx: DocContext): { lines: LineResult[]; totals: DocTotals } {
  const results = lines.map((l) => computeLine(l, ctx));
  const sum = (k: keyof LineResult) => results.reduce((a, r) => a + r[k], 0);
  const taxable = sum('taxable');
  const cgst = sum('cgst');
  const sgst = sum('sgst');
  const igst = sum('igst');
  const taxTotal = cgst + sgst + igst;
  const before = taxable + taxTotal;
  const roundOff = ctx.roundOff ? roundHalfUp(before / 100) * 100 - before : 0;
  const grandTotal = before + roundOff;
  const byRate = new Map<number, { ratePct: number; taxable: number; cgst: number; sgst: number; igst: number }>();
  lines.forEach((l, i) => {
    const r = results[i];
    if (!r || l.kind === 'heading' || !ctx.gst) return;
    const e = byRate.get(l.taxRatePct) ?? { ratePct: l.taxRatePct, taxable: 0, cgst: 0, sgst: 0, igst: 0 };
    e.taxable += r.taxable;
    e.cgst += r.cgst;
    e.sgst += r.sgst;
    e.igst += r.igst;
    byRate.set(l.taxRatePct, e);
  });
  const maxLinePct = Math.max(0, ...lines.map(lineDiscountPct));
  return {
    lines: results,
    totals: {
      subTotal: sum('gross'),
      discountTotal: sum('discount'),
      taxable,
      cgst,
      sgst,
      igst,
      taxTotal,
      roundOff,
      grandTotal,
      inWords: amountInWords(grandTotal),
      taxByRate: [...byRate.values()].sort((a, b) => a.ratePct - b.ratePct),
      maxDiscountPct: Math.max(maxLinePct, ctx.overallDiscountPct ?? 0),
    },
  };
}
