/** Document HTML (ADR-009): the same template renders the web preview and the PDF. */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { renderDocumentHtml, type DocInput, type DocLine } from '../src/index.js';

const line = (i: number): DocLine => ({ description: `Service line ${i}`, hsnSac: '998314', qty: 1, unit: 'Nos', rate: 100_000, discount: 0, taxable: 100_000, taxRatePct: 18, cgst: 9_000, sgst: 9_000, igst: 0, total: 118_000 });

const base = (over: Partial<DocInput> = {}): DocInput => ({
  kind: 'quotation', number: 'QT/26-27/0007-R1', date: '2026-11-13', validUntil: '2026-11-28',
  company: { legalName: 'Acme Interiors', address: '12 MG Road, Bengaluru', gstin: '29ABCDE1234F1Z5', stateCode: '29', signatory: 'Proprietor', logoDataUrl: 'data:image/png;base64,iVBORw0KGgo=' },
  billTo: { name: 'Ravi Designs', address: '1 Brigade Rd, Bengaluru', stateCode: '29' },
  lines: [line(1), line(2)],
  totals: { subTotal: 200_000, discountTotal: 0, taxable: 200_000, cgst: 18_000, sgst: 18_000, igst: 0, roundOff: 0, grandTotal: 236_000, inWords: 'Rupees Two Thousand Three Hundred Sixty Only' },
  terms: '50 % advance, balance on delivery.',
  ...over,
});

describe('document templates', () => {
  it('TC-165 FR-055 AC1 quotation shows logo, company, number + revision, customer, lines, totals, validity, terms, signature', async () => {
    const html = await renderDocumentHtml(base());
    for (const s of ['QUOTATION', 'Acme Interiors', '29ABCDE1234F1Z5', 'QT/26-27/0007-R1', 'Ravi Designs', 'Service line 1', 'Service line 2', '2,360.00', 'Two Thousand Three Hundred Sixty', '50 % advance', 'Proprietor']) expect(html).toContain(s);
    expect(html).toContain('data:image/png;base64');
    expect(html).toMatch(/28-11-2026|2026-11-28/); // validity
  });

  it('TC-195 FR-067 AC1 40 lines: table header repeats on every page and the PDF footer prints "Page x of y"', async () => {
    const html = await renderDocumentHtml(base({ kind: 'tax_invoice', number: 'INV/26-27/0001', lines: Array.from({ length: 40 }, (_, i) => line(i + 1)) }));
    expect((html.match(/Service line \d+/g) ?? []).length).toBe(40);
    expect(html).toContain('thead{display:table-header-group}');
    const pdf = readFileSync(new URL('../../../apps/api/src/pdf.ts', import.meta.url), 'utf8');
    expect(pdf).toMatch(/Page <span class="pageNumber"><\/span> of <span class="totalPages"><\/span>/);
  });

  it('TC-196 FR-067 AC2 QR switched off → payment block shows bank details only', async () => {
    const payment = { balance: 236_000, paid: 0, vpa: 'acme@okhdfcbank', payeeName: 'Acme Interiors', bank: { name: 'HDFC Bank', accountNo: '50100123456789', ifsc: 'HDFC0001234' } };
    const off = await renderDocumentHtml(base({ kind: 'tax_invoice', number: 'INV/26-27/0001', payment: { ...payment, showQr: false } }));
    expect(off).toContain('HDFC0001234');
    expect(off).not.toContain('<svg');
    const on = await renderDocumentHtml(base({ kind: 'tax_invoice', number: 'INV/26-27/0001', payment: { ...payment, showQr: true } }));
    expect(on).toContain('<svg');
  });

  it('escapes user content (no HTML injection into documents)', async () => {
    const html = await renderDocumentHtml(base({ billTo: { name: '<script>alert(1)</script>' } }));
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('renders sales order with Hopepitome default branding and styling', async () => {
    const html = await renderDocumentHtml({
      kind: 'order',
      number: 'SO/26-27/0002',
      date: '2026-11-24',
      expectedDelivery: '2026-12-15',
      company: {
        legalName: 'HopEpitome Strategics',
        address: 'Bangalore, Karnataka',
        stateCode: '29',
        website: 'hopepitome.com',
      },
      billTo: { name: 'Sharma Textiles', address: 'Bangalore' },
      lines: [line(1)],
      totals: { subTotal: 100_000, discountTotal: 0, taxable: 100_000, cgst: 9_000, sgst: 9_000, igst: 0, roundOff: 0, grandTotal: 118_000, inWords: 'Rupees One Thousand One Hundred Eighty Only' },
    });
    expect(html).toContain('SALES ORDER');
    expect(html).toContain('SO/26-27/0002');
    expect(html).toContain('HopEpitome Strategics');
    expect(html).toContain('hopepitome.com');
  });

  it('renders payment receipt with allocation details', async () => {
    const html = await renderDocumentHtml({
      kind: 'receipt',
      number: 'REC/26-27/0001',
      date: '2026-11-24',
      company: {
        legalName: 'HopEpitome Strategics',
        address: 'Bangalore, Karnataka',
        stateCode: '29',
      },
      billTo: { name: 'Sharma Textiles' },
      lines: [],
      totals: { subTotal: 0, discountTotal: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0, roundOff: 0, grandTotal: 50_000, inWords: 'Rupees Five Hundred Only' },
      receipt: {
        amount: 50_000,
        mode: 'upi',
        reference: 'UPI123456789',
        tds: 0,
        allocations: [{ number: 'INV/26-27/0001', amount: 50_000 }],
      },
    });
    expect(html).toContain('PAYMENT RECEIPT');
    expect(html).toContain('INV/26-27/0001');
    expect(html).toContain('UPI123456789');
  });

  it('renders multi-currency USD export invoice with statutory INR conversion block', async () => {
    const html = await renderDocumentHtml({
      kind: 'tax_invoice',
      number: 'INV/26-27/0020',
      title: 'EXPORT INVOICE',
      date: '2026-11-27',
      currency: 'USD',
      exchangeRate: 84.5,
      baseCurrency: 'INR',
      taxTreatment: 'export_lut',
      company: {
        legalName: 'HopEpitome Strategics',
        address: 'Bangalore, Karnataka',
        stateCode: '29',
        taxRegime: 'IN_GST',
        taxRegistered: true,
        gstin: '29AABCH1234F1Z0',
        lutNumber: 'LUT/2026-27/001',
      },
      billTo: {
        name: 'Global Corp Inc',
        country: 'US',
        address: '100 Silicon Way, San Jose, CA, USA',
      },
      lines: [
        {
          description: 'Cloud Consulting Services',
          hsnSac: '998313',
          qty: 1,
          unit: 'Nos',
          rate: 100_000, // $1,000.00
          discount: 0,
          taxable: 100_000,
          taxRatePct: 0,
          cgst: 0,
          sgst: 0,
          igst: 0,
          total: 100_000,
        },
      ],
      totals: {
        subTotal: 100_000,
        discountTotal: 0,
        taxable: 100_000,
        cgst: 0,
        sgst: 0,
        igst: 0,
        roundOff: 0,
        grandTotal: 100_000,
        inWords: 'US Dollars One Thousand and Zero Cents Only',
      },
    });

    expect(html).toContain('EXPORT INVOICE');
    expect(html).toContain('Supply meant for export under LUT without payment of integrated tax');
    expect(html).toContain('$ 1,000.00');
    expect(html).toContain('Total ($)');
    expect(html).toContain('Indian GST Statutory Currency Conversion');
    expect(html).toContain('Exchange Rate: <b>1 USD = ₹84.5</b>');
    expect(html).toContain('Grand Total: <b class="font-mono">₹ 84,500.00</b>');
    expect(html).toContain('Global Corp Inc');
    expect(html).toContain('100 Silicon Way, San Jose, CA, USA');
  });

  it('renders bill of supply for unregistered company without tax columns or GSTIN', async () => {
    const html = await renderDocumentHtml({
      kind: 'bill_of_supply',
      number: 'BOS/26-27/0001',
      date: '2026-11-27',
      company: {
        legalName: 'Small Biz',
        address: 'Bangalore, Karnataka',
        stateCode: '29',
        taxRegistered: false,
        gstin: null,
      },
      billTo: { name: 'Customer A', address: 'Bangalore' },
      lines: [
        {
          description: 'Consulting',
          qty: 1,
          rate: 50_000,
          discount: 0,
          taxable: 50_000,
          taxRatePct: 0,
          cgst: 0,
          sgst: 0,
          igst: 0,
          total: 50_000,
        },
      ],
      totals: {
        subTotal: 50_000,
        discountTotal: 0,
        taxable: 50_000,
        cgst: 0,
        sgst: 0,
        igst: 0,
        roundOff: 0,
        grandTotal: 50_000,
        inWords: 'Rupees Five Hundred Only',
      },
    });

    expect(html).toContain('BILL OF SUPPLY');
    expect(html).not.toContain('GSTIN:');
    expect(html).not.toContain('<th class="r">CGST</th>');
    expect(html).not.toContain('<th class="r">IGST</th>');
  });
});
