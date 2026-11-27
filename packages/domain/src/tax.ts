/**
 * Multi-Country Tax Determination Engine (RULE-034, Section C)
 * Pure functional domain logic shared across backend, frontend, PDFs and document generators.
 */

import type { TaxRegime } from './currency.js';

export type SupplyKind = 'goods' | 'services';

export const GST_STATES: Record<string, string> = {
  '01': 'Jammu and Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '26': 'Dadra and Nagar Haveli and Daman and Diu',
  '27': 'Maharashtra',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman and Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh',
  '38': 'Ladakh',
  '96': 'Outside India',
  '97': 'Other Territory',
};

export const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
export const TRN_PATTERN = /^[0-9]{15}$/;

/**
 * Validate GSTIN format, state code matching, and Luhn mod-36 checksum
 */
export function validateGstinChecksum(gstin: string): boolean {
  if (!GSTIN_PATTERN.test(gstin)) return false;
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const code = chars.indexOf(gstin[i]!);
    if (code === -1) return false;
    const factor = i % 2 === 0 ? 1 : 2;
    const prod = code * factor;
    const quotient = Math.floor(prod / 36);
    const remainder = prod % 36;
    sum += quotient + remainder;
  }
  const checkCode = (36 - (sum % 36)) % 36;
  return gstin[14] === chars[checkCode];
}

export function validateGstin(gstin?: string | null, stateCode?: string | null): string | null {
  if (!gstin) return null;
  const upper = gstin.trim().toUpperCase();
  if (!GSTIN_PATTERN.test(upper)) return 'GSTIN_INVALID';
  if (stateCode && upper.slice(0, 2) !== stateCode) return 'GSTIN_STATE_MISMATCH';
  // If checksum is invalid, flag it
  if (!validateGstinChecksum(upper)) return 'GSTIN_CHECKSUM_INVALID';
  return null;
}

export function validateTrn(trn?: string | null): boolean {
  if (!trn) return false;
  return TRN_PATTERN.test(trn.trim());
}

export type TaxCategory = 'taxable' | 'exempt' | 'nil_rated' | 'non_gst' | 'zero_rated';

export type CustomerTaxStatus =
  | 'registered'
  | 'unregistered'
  | 'consumer'
  | 'sez_unit'
  | 'sez_developer'
  | 'overseas'
  | 'un_body';

export interface TaxDeterminationCompany {
  country?: string | null; // ISO-2, default 'IN'
  stateCode?: string | null; // e.g. '29'
  taxRegistered: boolean;
  taxRegime?: TaxRegime | null; // 'IN_GST' | 'AE_VAT' | 'NONE'
  gstin?: string | null;
  trn?: string | null;
  lutNumber?: string | null;
  lutValidFrom?: string | null;
  lutValidTo?: string | null;
}

export interface TaxDeterminationCustomer {
  country?: string | null; // ISO-2, e.g. 'IN', 'AE', 'US'
  stateCode?: string | null; // e.g. '29', '27', 'Dubai'
  taxStatus?: CustomerTaxStatus | string | null;
  taxId?: string | null;
  gstin?: string | null;
  trn?: string | null;
}

export interface TaxLineInput {
  taxCategory?: TaxCategory;
  taxRatePct: number;
  reverseCharge?: boolean;
}

export interface TaxDeterminationInput {
  company: TaxDeterminationCompany;
  customer: TaxDeterminationCustomer;
  docDate?: string | null; // YYYY-MM-DD
  docKind?: 'quotation' | 'order' | 'tax_invoice' | 'bill_of_supply' | 'credit_note' | 'receipt' | string;
  placeOfSupplyOverride?: string | null;
  placeOfSupplyReason?: string | null;
  exportOption?: 'lut' | 'igst';
  lines?: TaxLineInput[];
}

export type TaxTreatment =
  | 'intra_state' // CGST + SGST
  | 'inter_state' // IGST
  | 'sez_lut' // 0% under LUT
  | 'sez_igst' // IGST on payment
  | 'export_lut' // 0% under LUT (POS 96)
  | 'export_igst' // IGST on payment (POS 96)
  | 'ae_standard' // 5% UAE VAT
  | 'ae_zero_rated' // 0% UAE VAT
  | 'ae_exempt' // Exempt
  | 'bill_of_supply' // Unregistered supplier / exempt
  | 'none'; // No tax

export interface ComputedLineTax {
  effectiveTaxRatePct: number;
  cgstPct: number;
  sgstPct: number;
  igstPct: number;
  vatPct: number;
  isZeroRated: boolean;
  isExempt: boolean;
  reverseCharge: boolean;
  taxCategory: TaxCategory;
}

export interface TaxDeterminationResult {
  taxRegime: TaxRegime;
  treatment: TaxTreatment;
  isRegisteredSupplier: boolean;
  placeOfSupply: string;
  placeOfSupplyLabel: string;
  lutApplied: boolean;
  lutNumber: string | null;
  mandatoryText: string | null;
  documentTitle: string;
  documentSubtitle: string;
  lines: ComputedLineTax[];
}

/** Check if LUT is valid on given date */
export function isLutValid(company: TaxDeterminationCompany, docDate?: string | null): boolean {
  if (!company.lutNumber) return false;
  const d = docDate || new Date().toISOString().slice(0, 10);
  if (company.lutValidFrom && d < company.lutValidFrom) return false;
  if (company.lutValidTo && d > company.lutValidTo) return false;
  return true;
}

/**
 * Determine Place of Supply according to statutory rules
 */
export function determinePlaceOfSupply(
  company?: TaxDeterminationCompany | null,
  customer?: TaxDeterminationCustomer | null,
  override?: string | null
): { code: string; label: string } {
  if (override) {
    const lbl = GST_STATES[override] || override;
    return { code: override, label: `${lbl} (${override})` };
  }

  const custCountry = ((customer && customer.country) || 'IN').toUpperCase();
  const compCountry = ((company && company.country) || 'IN').toUpperCase();

  // If customer is outside India (for Indian company)
  if (compCountry === 'IN' && custCountry !== 'IN') {
    return { code: '96', label: 'Outside India (96)' };
  }

  // If customer is in India
  if (custCountry === 'IN') {
    const sc = ((customer && customer.stateCode) || (company && company.stateCode) || '29').trim();
    const lbl = GST_STATES[sc] || sc;
    return { code: sc, label: `${lbl} (${sc})` };
  }

  // Other countries
  const code = (customer && customer.stateCode) || '96';
  return { code, label: customer && customer.stateCode ? `${customer.stateCode}, ${custCountry}` : custCountry };
}

/**
 * Core Tax Determination Engine (Section C)
 */
export function determineTax(input?: TaxDeterminationInput | null): TaxDeterminationResult {
  const safeInput = input || {
    company: { country: 'IN', stateCode: '29', taxRegistered: true, taxRegime: 'IN_GST' },
    customer: { country: 'IN', stateCode: '29', taxStatus: 'unregistered' },
  };
  const { docDate, docKind = 'tax_invoice', placeOfSupplyOverride, lines = [] } = safeInput;
  const company = safeInput.company || { country: 'IN', stateCode: '29', taxRegistered: true, taxRegime: 'IN_GST' };
  const customer = safeInput.customer || { country: 'IN', stateCode: '29', taxStatus: 'unregistered' };

  const compCountry = (company.country || 'IN').toUpperCase();
  const custCountry = (customer.country || 'IN').toUpperCase();
  const taxRegime: TaxRegime = company.taxRegime || (compCountry === 'IN' ? 'IN_GST' : compCountry === 'AE' ? 'AE_VAT' : 'NONE');

  const pos = determinePlaceOfSupply(company, customer, placeOfSupplyOverride);
  const custStatus = (customer.taxStatus || (customer.gstin ? 'registered' : 'unregistered')).toLowerCase() as CustomerTaxStatus;
  const isRegisteredSupplier = Boolean(company.taxRegistered);

  let treatment: TaxTreatment = 'none';
  let lutApplied = false;
  let lutNumber: string | null = null;
  let mandatoryText: string | null = null;

  // 1. NON-REGISTERED SUPPLIER OR NONE REGIME
  if (!isRegisteredSupplier || taxRegime === 'NONE') {
    treatment = isRegisteredSupplier ? 'none' : 'bill_of_supply';
  } else if (taxRegime === 'IN_GST') {
    // 2. INDIAN GST RULES
    const compState = (company.stateCode || '29').trim();
    const isOverseas = custCountry !== 'IN' || custStatus === 'overseas';
    const isSez = custStatus === 'sez_unit' || custStatus === 'sez_developer';
    const validLut = isLutValid(company, docDate);
    const exportOpt = input.exportOption || (validLut ? 'lut' : 'igst');

    if (isOverseas) {
      if (exportOpt === 'lut' && validLut) {
        treatment = 'export_lut';
        lutApplied = true;
        lutNumber = company.lutNumber || null;
        mandatoryText = `Supply meant for export under LUT without payment of IGST (LUT: ${company.lutNumber || 'N/A'})`;
      } else {
        treatment = 'export_igst';
        mandatoryText = 'Supply meant for export on payment of IGST';
      }
    } else if (isSez) {
      if (exportOpt === 'lut' && validLut) {
        treatment = 'sez_lut';
        lutApplied = true;
        lutNumber = company.lutNumber || null;
        mandatoryText = `Supply to SEZ under LUT without payment of IGST (LUT: ${company.lutNumber || 'N/A'})`;
      } else {
        treatment = 'sez_igst';
        mandatoryText = 'Supply to SEZ on payment of IGST';
      }
    } else {
      // Domestic supply (Registered, Unregistered, Consumer, UN body)
      const intra = pos.code === compState;
      treatment = intra ? 'intra_state' : 'inter_state';
    }
  } else if (taxRegime === 'AE_VAT') {
    // 3. UAE VAT RULES
    if (custCountry === 'AE') {
      treatment = 'ae_standard';
    } else {
      // Export outside UAE
      treatment = 'ae_zero_rated';
      mandatoryText = 'Zero-rated supply outside the State (UAE Federal Decree-Law No. 8 of 2017)';
    }
  }

  // Document Title Determination (Section E.3)
  let documentTitle = 'TAX INVOICE';
  let documentSubtitle = 'Issued under Section 31 of CGST Act, 2017';

  if (docKind === 'credit_note') {
    documentTitle = 'TAX CREDIT NOTE';
    documentSubtitle = 'Credit Note issued under Section 34 of CGST Act, 2017';
  } else if (docKind === 'quotation') {
    documentTitle = 'QUOTATION';
    documentSubtitle = 'Commercial Proposal & Scope Schedule';
  } else if (docKind === 'order') {
    documentTitle = 'SALES ORDER';
    documentSubtitle = 'Official Confirmation of Sales Order';
  } else if (docKind === 'receipt') {
    documentTitle = 'PAYMENT RECEIPT';
    documentSubtitle = 'Official Payment Acknowledgement & Receipt Voucher';
  } else {
    // Invoices
    if (!isRegisteredSupplier) {
      documentTitle = 'BILL OF SUPPLY';
      documentSubtitle = 'Issued by Composition / Unregistered Supplier';
    } else if (treatment === 'export_lut' || treatment === 'export_igst' || treatment === 'sez_lut') {
      documentTitle = 'EXPORT INVOICE';
      documentSubtitle = treatment.includes('lut')
        ? 'Export of Services / Goods under LUT without payment of Integrated Tax'
        : 'Export of Services / Goods on payment of Integrated Tax';
    } else if (taxRegime === 'AE_VAT') {
      documentTitle = 'TAX INVOICE / فاتورة ضريبية';
      documentSubtitle = 'Issued under UAE Federal Decree-Law No. (8) of 2017 on Value Added Tax';
    }
  }

  // Process per-line taxes
  const computedLines: ComputedLineTax[] = lines.map((l) => {
    const cat = l.taxCategory || 'taxable';
    const isExempt = cat === 'exempt' || cat === 'nil_rated' || cat === 'non_gst';
    const isZero = cat === 'zero_rated' || treatment === 'export_lut' || treatment === 'sez_lut' || treatment === 'ae_zero_rated';

    let effectiveTaxRatePct = 0;
    let cgstPct = 0;
    let sgstPct = 0;
    let igstPct = 0;
    let vatPct = 0;

    if (!isRegisteredSupplier || treatment === 'bill_of_supply' || treatment === 'none' || isExempt) {
      effectiveTaxRatePct = 0;
    } else if (isZero) {
      effectiveTaxRatePct = 0;
    } else if (taxRegime === 'AE_VAT') {
      vatPct = cat === 'taxable' ? (l.taxRatePct > 0 ? l.taxRatePct : 5) : 0;
      effectiveTaxRatePct = vatPct;
    } else if (taxRegime === 'IN_GST') {
      const baseRate = l.taxRatePct > 0 ? l.taxRatePct : 18;
      if (treatment === 'intra_state') {
        cgstPct = baseRate / 2;
        sgstPct = baseRate / 2;
        effectiveTaxRatePct = baseRate;
      } else if (treatment === 'inter_state' || treatment === 'export_igst' || treatment === 'sez_igst') {
        igstPct = baseRate;
        effectiveTaxRatePct = baseRate;
      }
    }

    return {
      effectiveTaxRatePct,
      cgstPct,
      sgstPct,
      igstPct,
      vatPct,
      isZeroRated: isZero,
      isExempt,
      reverseCharge: Boolean(l.reverseCharge),
      taxCategory: cat,
    };
  });

  return {
    taxRegime,
    treatment,
    isRegisteredSupplier,
    placeOfSupply: pos.code,
    placeOfSupplyLabel: pos.label,
    lutApplied,
    lutNumber,
    mandatoryText,
    documentTitle,
    documentSubtitle,
    lines: computedLines,
  };
}

export function isIntraState(companyState: string, pos: string): boolean {
  return companyState === pos;
}

export function placeOfSupply(i: { kind: SupplyKind; companyState: string; billingState?: string | null; shippingState?: string | null }): string {
  if (i.kind === 'goods') return i.shippingState || i.billingState || i.companyState;
  return i.billingState || i.companyState;
}
