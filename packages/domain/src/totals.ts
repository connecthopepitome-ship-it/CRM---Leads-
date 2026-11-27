import { roundHalfUp, type Paise } from './money.js';
import { amountInWords } from './words.js';
import { currencyAmountInWords, type TaxRegime } from './currency.js';
import type { TaxCategory, TaxTreatment } from './tax.js';

export interface LineInput {
  kind?: 'item' | 'heading';
  description?: string;
  qty: number;
  rate: number; // in subunits (paise / cents / fils)
  discountPct?: number | null;
  discountAmt?: number | null;
  taxRatePct: number;
  taxCategory?: TaxCategory;
  hsnSac?: string | null;
  reverseCharge?: boolean;
}

export interface LineResult {
  gross: number;
  discount: number;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  vat: number;
  total: number;
}

export interface DocContext {
  gst?: boolean; // legacy flag: true if GST registered and not a bill of supply
  intraState?: boolean; // legacy flag: true if same state
  taxRegime?: TaxRegime;
  treatment?: TaxTreatment;
  currency?: string; // e.g. 'INR', 'USD', 'AED'
  baseCurrency?: string; // e.g. 'INR'
  exchangeRate?: number; // e.g. 84.50 (1 doc unit = 84.50 base units)
  overallDiscountPct?: number;
  roundOff?: boolean;
}

export interface DocTotals {
  currency: string;
  exchangeRate: number;
  subTotal: number;
  discountTotal: number;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  vat: number;
  taxTotal: number;
  roundOff: number;
  grandTotal: number;
  inWords: string;
  taxByRate: { ratePct: number; taxable: number; cgst: number; sgst: number; igst: number; vat: number }[];
  maxDiscountPct: number;
  // Base currency equivalents for reports & foreign documents (Section D.2, D.4)
  baseCurrency?: string;
  baseTaxable?: number;
  baseCgst?: number;
  baseSgst?: number;
  baseIgst?: number;
  baseVat?: number;
  baseTaxTotal?: number;
  baseGrandTotal?: number;
}

/** One line (RULE-035): gross = qty × rate; discount; taxable; tax per line rounded half-up. */
export function computeLine(l: LineInput, ctx: DocContext): LineResult {
  if (l.kind === 'heading') return { gross: 0, discount: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0, vat: 0, total: 0 };
  const gross = roundHalfUp(l.qty * l.rate);
  const lineDisc = l.discountAmt != null ? l.discountAmt : roundHalfUp((gross * (l.discountPct ?? 0)) / 100);
  if (lineDisc < 0 || lineDisc > gross) throw new RangeError('DISCOUNT_EXCEEDS_GROSS');
  const overall = ctx.overallDiscountPct ? roundHalfUp(((gross - lineDisc) * ctx.overallDiscountPct) / 100) : 0;
  const discount = lineDisc + overall;
  const taxable = gross - discount;

  let cgst = 0;
  let sgst = 0;
  let igst = 0;
  let vat = 0;

  const cat = l.taxCategory || 'taxable';
  const isExempt = cat === 'exempt' || cat === 'nil_rated' || cat === 'non_gst';
  const isZero = cat === 'zero_rated';

  // Check treatment or legacy flags
  const treatment = ctx.treatment;
  if (!isExempt && !isZero && l.taxRatePct > 0) {
    if (treatment) {
      if (treatment === 'intra_state') {
        cgst = roundHalfUp((taxable * l.taxRatePct) / 200);
        sgst = cgst;
      } else if (treatment === 'inter_state' || treatment === 'export_igst' || treatment === 'sez_igst') {
        igst = roundHalfUp((taxable * l.taxRatePct) / 100);
      } else if (treatment === 'ae_standard') {
        vat = roundHalfUp((taxable * l.taxRatePct) / 100);
      }
      // 'export_lut', 'sez_lut', 'ae_zero_rated', 'bill_of_supply', 'none' => 0 tax
    } else if (ctx.gst !== false) {
      // Legacy fallback
      if (ctx.intraState) {
        cgst = roundHalfUp((taxable * l.taxRatePct) / 200);
        sgst = cgst;
      } else {
        igst = roundHalfUp((taxable * l.taxRatePct) / 100);
      }
    }
  }

  return { gross, discount, taxable, cgst, sgst, igst, vat, total: taxable + cgst + sgst + igst + vat };
}

/** Effective discount % of a line, for approval checks (RULE-027). */
export function lineDiscountPct(l: LineInput): number {
  if (l.kind === 'heading') return 0;
  const gross = roundHalfUp(l.qty * l.rate);
  if (gross === 0) return 0;
  const d = l.discountAmt != null ? l.discountAmt : (gross * (l.discountPct ?? 0)) / 100;
  return (d / gross) * 100;
}

/** Document totals incl. tax summary, multi-currency conversion, round-off, and words. */
export function computeDocument(lines: LineInput[], ctx: DocContext): { lines: LineResult[]; totals: DocTotals } {
  const currency = ctx.currency || 'INR';
  const baseCurrency = ctx.baseCurrency || 'INR';
  const exchangeRate = Number(ctx.exchangeRate || 1.0);

  const results = lines.map((l) => computeLine(l, ctx));
  const sum = (k: keyof LineResult) => results.reduce((a, r) => a + r[k], 0);

  const taxable = sum('taxable');
  const cgst = sum('cgst');
  const sgst = sum('sgst');
  const igst = sum('igst');
  const vat = sum('vat');
  const taxTotal = cgst + sgst + igst + vat;
  const before = taxable + taxTotal;

  // Round-off to nearest integer subunit (only if enabled)
  const roundOff = ctx.roundOff ? roundHalfUp(before / 100) * 100 - before : 0;
  const grandTotal = before + roundOff;

  const hasTax = ctx.treatment ? !['bill_of_supply', 'none'].includes(ctx.treatment) : ctx.gst !== false;
  const byRate = new Map<number, { ratePct: number; taxable: number; cgst: number; sgst: number; igst: number; vat: number }>();
  lines.forEach((l, i) => {
    const r = results[i];
    if (!r || l.kind === 'heading' || !hasTax) return;
    const rate = l.taxRatePct || 0;
    const e = byRate.get(rate) ?? { ratePct: rate, taxable: 0, cgst: 0, sgst: 0, igst: 0, vat: 0 };
    e.taxable += r.taxable;
    e.cgst += r.cgst;
    e.sgst += r.sgst;
    e.igst += r.igst;
    e.vat += r.vat;
    byRate.set(rate, e);
  });

  const words = currency === 'INR' ? amountInWords(grandTotal) : currencyAmountInWords(grandTotal, currency);
  const maxLinePct = Math.max(0, ...lines.map(lineDiscountPct));

  // Compute base currency equivalents if foreign currency
  const isForeign = currency !== baseCurrency && exchangeRate > 0 && exchangeRate !== 1;
  const toBase = (val: number) => roundHalfUp(val * exchangeRate);

  const totals: DocTotals = {
    currency,
    exchangeRate,
    subTotal: sum('gross'),
    discountTotal: sum('discount'),
    taxable,
    cgst,
    sgst,
    igst,
    vat,
    taxTotal,
    roundOff,
    grandTotal,
    inWords: words,
    taxByRate: [...byRate.values()].sort((a, b) => a.ratePct - b.ratePct),
    maxDiscountPct: Math.max(maxLinePct, ctx.overallDiscountPct ?? 0),
    ...(isForeign
      ? {
          baseCurrency,
          baseTaxable: toBase(taxable),
          baseCgst: toBase(cgst),
          baseSgst: toBase(sgst),
          baseIgst: toBase(igst),
          baseVat: toBase(vat),
          baseTaxTotal: toBase(taxTotal),
          baseGrandTotal: toBase(grandTotal),
        }
      : {}),
  };

  return { lines: results, totals };
}
