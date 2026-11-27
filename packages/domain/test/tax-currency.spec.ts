import { describe, expect, it } from 'vitest';
import {
  determineTax,
  validateGstin,
  validateGstinChecksum,
  validateTrn,
  formatCurrency,
  currencyAmountInWords,
  computeDocument,
} from '../src/index.js';

describe('Tax Determination Engine (Section C & Verification Scenarios)', () => {
  const compRegisteredKA = {
    country: 'IN',
    stateCode: '29',
    taxRegistered: true,
    taxRegime: 'IN_GST' as const,
    gstin: '29AABCU9603R1ZM',
    lutNumber: 'AD290324001234F',
    lutValidFrom: '2026-04-01',
    lutValidTo: '2027-03-31',
  };

  const compUnregistered = {
    country: 'IN',
    stateCode: '29',
    taxRegistered: false,
    taxRegime: 'IN_GST' as const,
  };

  const compUAE = {
    country: 'AE',
    stateCode: 'Dubai',
    taxRegistered: true,
    taxRegime: 'AE_VAT' as const,
    trn: '100123456700003',
  };

  // Scenario 1: IN registered customer, same state (KA) -> CGST+SGST, INR, Tax Invoice
  it('Scenario 1: IN registered customer, same state (KA) -> CGST+SGST, Tax Invoice', () => {
    const res = determineTax({
      company: compRegisteredKA,
      customer: { country: 'IN', stateCode: '29', taxStatus: 'registered', gstin: '29AABCU9603R1ZM' },
      lines: [{ taxCategory: 'taxable', taxRatePct: 18 }],
    });
    expect(res.treatment).toBe('intra_state');
    expect(res.documentTitle).toBe('TAX INVOICE');
    expect(res.placeOfSupply).toBe('29');
    expect(res.lines[0]!.cgstPct).toBe(9);
    expect(res.lines[0]!.sgstPct).toBe(9);
    expect(res.lines[0]!.igstPct).toBe(0);
  });

  // Scenario 2: IN registered customer, other state (MH, GSTIN 27…) -> IGST
  it('Scenario 2: IN registered customer, other state (MH, 27) -> IGST', () => {
    const res = determineTax({
      company: compRegisteredKA,
      customer: { country: 'IN', stateCode: '27', taxStatus: 'registered', gstin: '27AAPFU0939F1ZV' },
      lines: [{ taxCategory: 'taxable', taxRatePct: 18 }],
    });
    expect(res.treatment).toBe('inter_state');
    expect(res.documentTitle).toBe('TAX INVOICE');
    expect(res.placeOfSupply).toBe('27');
    expect(res.lines[0]!.cgstPct).toBe(0);
    expect(res.lines[0]!.sgstPct).toBe(0);
    expect(res.lines[0]!.igstPct).toBe(18);
  });

  // Scenario 3: IN unregistered consumer, same state -> CGST+SGST, "Unregistered", no GSTIN printed
  it('Scenario 3: IN unregistered consumer, same state -> CGST+SGST', () => {
    const res = determineTax({
      company: compRegisteredKA,
      customer: { country: 'IN', stateCode: '29', taxStatus: 'consumer' },
      lines: [{ taxCategory: 'taxable', taxRatePct: 18 }],
    });
    expect(res.treatment).toBe('intra_state');
    expect(res.lines[0]!.cgstPct).toBe(9);
    expect(res.lines[0]!.sgstPct).toBe(9);
  });

  // Scenario 4: IN unregistered, other state -> IGST
  it('Scenario 4: IN unregistered, other state -> IGST', () => {
    const res = determineTax({
      company: compRegisteredKA,
      customer: { country: 'IN', stateCode: '27', taxStatus: 'unregistered' },
      lines: [{ taxCategory: 'taxable', taxRatePct: 18 }],
    });
    expect(res.treatment).toBe('inter_state');
    expect(res.lines[0]!.igstPct).toBe(18);
  });

  // Scenario 5: SEZ unit with LUT -> 0% zero-rated, LUT text
  it('Scenario 5: SEZ unit with LUT -> 0% zero-rated, LUT text', () => {
    const res = determineTax({
      company: compRegisteredKA,
      customer: { country: 'IN', stateCode: '29', taxStatus: 'sez_unit', gstin: '29AAACS0001A1Z5' },
      docDate: '2026-11-27',
      lines: [{ taxCategory: 'taxable', taxRatePct: 18 }],
    });
    expect(res.treatment).toBe('sez_lut');
    expect(res.lutApplied).toBe(true);
    expect(res.documentTitle).toBe('EXPORT INVOICE');
    expect(res.lines[0]!.isZeroRated).toBe(true);
    expect(res.lines[0]!.effectiveTaxRatePct).toBe(0);
    expect(res.mandatoryText).toContain('Supply to SEZ under LUT without payment of IGST');
  });

  // Scenario 6: Overseas customer (UAE) in AED with LUT -> export invoice, 0% IGST, POS 96
  it('Scenario 6: Overseas customer (UAE) in AED with LUT -> export invoice, 0% IGST, POS 96', () => {
    const res = determineTax({
      company: compRegisteredKA,
      customer: { country: 'AE', taxStatus: 'overseas' },
      docDate: '2026-11-27',
      lines: [{ taxCategory: 'taxable', taxRatePct: 18 }],
    });
    expect(res.treatment).toBe('export_lut');
    expect(res.placeOfSupply).toBe('96');
    expect(res.documentTitle).toBe('EXPORT INVOICE');
    expect(res.lines[0]!.isZeroRated).toBe(true);
    expect(res.lines[0]!.effectiveTaxRatePct).toBe(0);
    expect(res.mandatoryText).toContain('Supply meant for export under LUT without payment of IGST');
  });

  // Scenario 7: Overseas customer (US) in USD without LUT -> IGST 18% shown in INR, document in USD
  it('Scenario 7: Overseas customer without LUT -> export with IGST', () => {
    const res = determineTax({
      company: { ...compRegisteredKA, lutNumber: null },
      customer: { country: 'US', taxStatus: 'overseas' },
      lines: [{ taxCategory: 'taxable', taxRatePct: 18 }],
    });
    expect(res.treatment).toBe('export_igst');
    expect(res.placeOfSupply).toBe('96');
    expect(res.lines[0]!.igstPct).toBe(18);
    expect(res.mandatoryText).toContain('Supply meant for export on payment of IGST');
  });

  // Scenario 8: Exempt/nil-rated item line mixed with a taxable line -> correct per-line tax
  it('Scenario 8: Exempt/nil-rated item line mixed with taxable line', () => {
    const res = determineTax({
      company: compRegisteredKA,
      customer: { country: 'IN', stateCode: '29', taxStatus: 'registered' },
      lines: [
        { taxCategory: 'taxable', taxRatePct: 18 },
        { taxCategory: 'exempt', taxRatePct: 0 },
        { taxCategory: 'nil_rated', taxRatePct: 0 },
      ],
    });
    expect(res.lines[0]!.cgstPct).toBe(9);
    expect(res.lines[0]!.sgstPct).toBe(9);
    expect(res.lines[1]!.isExempt).toBe(true);
    expect(res.lines[1]!.effectiveTaxRatePct).toBe(0);
    expect(res.lines[2]!.isExempt).toBe(true);
    expect(res.lines[2]!.effectiveTaxRatePct).toBe(0);
  });

  // Scenario 9: Company switched to "not registered" -> Bill of Supply, no tax lines
  it('Scenario 9: Company not registered -> Bill of Supply, no tax', () => {
    const res = determineTax({
      company: compUnregistered,
      customer: { country: 'IN', stateCode: '29', taxStatus: 'registered' },
      lines: [{ taxCategory: 'taxable', taxRatePct: 18 }],
    });
    expect(res.treatment).toBe('bill_of_supply');
    expect(res.documentTitle).toBe('BILL OF SUPPLY');
    expect(res.lines[0]!.effectiveTaxRatePct).toBe(0);
  });

  // Scenario 10: UAE tenant (AE_VAT): UAE customer with TRN -> 5% VAT; export -> 0%
  it('Scenario 10: UAE tenant -> 5% VAT for UAE; 0% for exports', () => {
    const uaeDomestic = determineTax({
      company: compUAE,
      customer: { country: 'AE', stateCode: 'Dubai', trn: '100987654300003' },
      lines: [{ taxCategory: 'taxable', taxRatePct: 5 }],
    });
    expect(uaeDomestic.treatment).toBe('ae_standard');
    expect(uaeDomestic.lines[0]!.vatPct).toBe(5);

    const uaeExport = determineTax({
      company: compUAE,
      customer: { country: 'US', taxStatus: 'overseas' },
      lines: [{ taxCategory: 'taxable', taxRatePct: 5 }],
    });
    expect(uaeExport.treatment).toBe('ae_zero_rated');
    expect(uaeExport.lines[0]!.vatPct).toBe(0);
  });
});

describe('Multi-Currency & Formatting Engine (Section D)', () => {
  it('formats amounts in Indian and International systems', () => {
    expect(formatCurrency(123456700, 'INR')).toBe('₹ 12,34,567.00');
    expect(formatCurrency(123456700, 'USD')).toBe('$ 1,234,567.00');
    expect(formatCurrency(123456700, 'AED')).toBe('AED 1,234,567.00');
    expect(formatCurrency(1234500, 'OMR')).toBe('OMR 1,234.500'); // 3 decimals
  });

  it('renders amount in words per currency', () => {
    expect(currencyAmountInWords(100050, 'INR')).toBe('Rupees One Thousand and Fifty Paise Only');
    expect(currencyAmountInWords(150000, 'USD')).toBe('US Dollars One Thousand Five Hundred Only');
    expect(currencyAmountInWords(250075, 'AED')).toBe('UAE Dirhams Two Thousand Five Hundred and Seventy-Five Fils Only');
  });

  it('computes document totals in document currency and converts to base currency', () => {
    // $100 line with 18% IGST export, exchange rate 84.50 INR per USD
    const { totals } = computeDocument(
      [{ qty: 1, rate: 10000, taxRatePct: 18 }],
      {
        currency: 'USD',
        baseCurrency: 'INR',
        exchangeRate: 84.5,
        treatment: 'export_igst',
      }
    );
    expect(totals.currency).toBe('USD');
    expect(totals.grandTotal).toBe(11800); // $118.00
    expect(totals.igst).toBe(1800); // $18.00
    expect(totals.inWords).toBe('US Dollars One Hundred and Eighteen Only');

    // Base currency (INR) equivalents
    expect(totals.baseCurrency).toBe('INR');
    expect(totals.baseGrandTotal).toBe(997100); // 11800 * 84.5 = 997,100 paise = ₹9,971.00
    expect(totals.baseIgst).toBe(152100); // 1800 * 84.5 = 152,100 paise = ₹1,521.00
  });

  it('validates TRN format for UAE', () => {
    expect(validateTrn('100123456700003')).toBe(true);
    expect(validateTrn('12345')).toBe(false);
    expect(validateTrn('ABC123456700003')).toBe(false);
  });
});
