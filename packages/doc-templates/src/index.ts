import QRCode from 'qrcode';
import {
  amountInWords,
  buildUpiUri,
  displayDate,
  formatINR,
  formatCurrency,
  currencyAmountInWords,
  CURRENCIES,
  GST_STATES,
  paymentBlockMode,
  type Paise,
} from '@ss/domain';
import { HOPEPITOME_LOGO_DATA_URL } from './logo.js';

export { HOPEPITOME_LOGO_DATA_URL, amountInWords };

/** Shared A4 document layout (FR-055, FR-067, FR-072, ADR-009). Pure HTML + CSS; rendered to PDF by headless Chromium / print. */

export interface DocCompany {
  legalName: string;
  tradeName?: string | null;
  tagline?: string | null;
  address: string;
  country?: string;
  currency?: string;
  taxRegime?: 'IN_GST' | 'AE_VAT' | 'NONE';
  taxRegistered?: boolean;
  gstin?: string | null;
  trn?: string | null;
  pan?: string | null;
  stateCode: string;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  jurisdiction?: string | null;
  signatory?: string | null;
  logoDataUrl?: string | null;
  lutNumber?: string | null;
  lutValidity?: string | null;
  bankName?: string | null;
  bankAccount?: string | null;
  bankIfsc?: string | null;
  bankBranch?: string | null;
  bankIban?: string | null;
  bankSwift?: string | null;
  bankCurrency?: string | null;
  upiId?: string | null;
}

export interface DocParty {
  name: string;
  company?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  stateCode?: string | null;
  country?: string | null;
  currency?: string | null;
  taxStatus?: string | null;
  taxId?: string | null;
  gstin?: string | null;
  trn?: string | null;
  phone?: string | null;
  email?: string | null;
}

export interface DocLine {
  kind?: 'item' | 'heading';
  description: string;
  hsnSac?: string | null;
  qty: number;
  unit?: string | null;
  rate: Paise;
  discount: Paise;
  taxable: Paise;
  taxRatePct: number;
  cgst: Paise;
  sgst: Paise;
  igst: Paise;
  total: Paise;
}

export interface DocTotalsView {
  subTotal: Paise;
  discountTotal: Paise;
  taxable: Paise;
  cgst: Paise;
  sgst: Paise;
  igst: Paise;
  roundOff: Paise;
  grandTotal: Paise;
  inWords: string;
}

export interface DocInput {
  kind: 'quotation' | 'order' | 'tax_invoice' | 'bill_of_supply' | 'proforma' | 'credit_note' | 'receipt';
  copy?: 'ORIGINAL' | 'DUPLICATE' | 'OFFICE COPY';
  title?: string | null;
  subtitle?: string | null;
  currency?: string;
  exchangeRate?: number;
  baseCurrency?: string;
  number: string | null;
  date: string;
  dueDate?: string | null;
  validUntil?: string | null;
  expectedDelivery?: string | null;
  refs?: { label: string; value: string }[];
  placeOfSupply?: string | null;
  company: DocCompany;
  billTo: DocParty;
  shipTo?: DocParty | null;
  lines: DocLine[];
  totals: DocTotalsView;
  baseTotals?: DocTotalsView | null;
  taxTreatment?: string;
  lutText?: string | null;
  terms?: string | null;
  notes?: string | null;
  payment?: {
    balance: Paise;
    paid: Paise;
    currency?: string;
    vpa?: string | null;
    payeeName?: string | null;
    trEnabled?: boolean;
    bank?: {
      name: string;
      accountNo: string;
      ifsc?: string;
      iban?: string;
      swift?: string;
      currency?: string;
      branch?: string;
    } | null;
    showQr: boolean;
  } | null;
  receipt?: {
    amount: Paise;
    currency?: string;
    exchangeRate?: number;
    baseAmount?: Paise;
    mode: string;
    reference?: string | null;
    tds: Paise;
    allocations: { number: string; amount: Paise }[];
    cancelledReason?: string | null;
  } | null;
  poweredBy?: boolean;
}

export const DEFAULT_HOPEPITOME_COMPANY: DocCompany = {
  legalName: 'HopEpitome Strategics',
  tradeName: 'HopEpitome',
  tagline: 'We build digital systems for businesses and distinctive professional identities for people.',
  address: 'No. 42, 4th Floor, Prestige Tech Park, Marathahalli-Sarjapur Outer Ring Road, Bangalore - 560103, Karnataka, India',
  country: 'IN',
  currency: 'INR',
  taxRegime: 'IN_GST',
  taxRegistered: true,
  gstin: null,
  stateCode: '29',
  phone: '+91 98450 11108',
  email: 'service@hopepitome.com',
  website: 'hopepitome.com',
  jurisdiction: 'Bangalore, Karnataka',
  signatory: 'HopEpitome Authorised Signatory',
  logoDataUrl: HOPEPITOME_LOGO_DATA_URL,
};

const TITLES: Record<DocInput['kind'], string> = {
  quotation: 'QUOTATION',
  order: 'SALES ORDER',
  tax_invoice: 'TAX INVOICE',
  bill_of_supply: 'BILL OF SUPPLY',
  proforma: 'PROFORMA INVOICE',
  credit_note: 'CREDIT NOTE',
  receipt: 'PAYMENT RECEIPT',
};

const SUBTITLES: Record<DocInput['kind'], string> = {
  quotation: 'Commercial Proposal & Scope Schedule',
  order: 'Official Confirmation of Sales Order',
  tax_invoice: 'Issued under Section 31 of CGST Act, 2017',
  bill_of_supply: 'Supply of Goods / Services (Composition/Exempt)',
  proforma: 'Commercial Proforma Assessment',
  credit_note: 'Credit Note under Section 34 of CGST Act',
  receipt: 'Official Payment Acknowledgement & Receipt Voucher',
};

export function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);
}

const m = (p: Paise) => esc(formatINR(p, false));
const nl2br = (s: string) => esc(s).replace(/\n/g, '<br>');

export async function upiQrSvg(uri: string): Promise<string> {
  return QRCode.toString(uri, { type: 'svg', errorCorrectionLevel: 'M', margin: 1, width: 130 });
}

async function paymentBlock(d: DocInput): Promise<string> {
  const p = d.payment;
  if (!p) return '';
  const cur = d.currency || d.company?.currency || 'INR';
  const fmt = (v: number) => formatCurrency(v, cur, true);
  const isPaid = p.balance <= 0 && p.paid > 0;

  if (isPaid) {
    return `
      <div class="pay-section pay-paid">
        <div class="stamp-paid">
          <span class="stamp-icon">✓</span> PAID IN FULL
        </div>
        <div class="pay-paid-details">
          <div class="pay-paid-title">Received with thanks: ${esc(fmt(p.paid))}</div>
          <div class="pay-paid-sub">All invoices linked to this commercial schedule have been cleared.</div>
        </div>
      </div>
    `;
  }

  const isForeignBank = cur !== 'INR' || !!p.bank?.iban || !!p.bank?.swift;
  let bankHtml = '';
  if (p.bank) {
    if (isForeignBank) {
      bankHtml = `
        <div class="bank-box">
          <div class="bank-title"><span class="bank-icon">🏛</span> International Wire Transfer (SWIFT / IBAN)</div>
          <div class="bank-grid">
            <div><span class="bank-lbl">Bank Name:</span> <b>${esc(p.bank.name)}</b></div>
            <div><span class="bank-lbl">IBAN / Account:</span> <b class="font-mono">${esc(p.bank.iban || p.bank.accountNo)}</b></div>
            ${p.bank.swift ? `<div><span class="bank-lbl">SWIFT / BIC:</span> <b class="font-mono">${esc(p.bank.swift)}</b></div>` : ''}
            <div><span class="bank-lbl">Currency:</span> <b class="font-mono">${esc(p.bank.currency || cur)}</b></div>
            ${p.bank.branch ? `<div><span class="bank-lbl">Branch / Country:</span> ${esc(p.bank.branch)}</div>` : ''}
          </div>
        </div>
      `;
    } else {
      bankHtml = `
        <div class="bank-box">
          <div class="bank-title"><span class="bank-icon">🏛</span> Direct Bank Transfer (NEFT / RTGS / IMPS)</div>
          <div class="bank-grid">
            <div><span class="bank-lbl">Bank Name:</span> <b>${esc(p.bank.name)}</b></div>
            <div><span class="bank-lbl">Account No:</span> <b class="font-mono">${esc(p.bank.accountNo)}</b></div>
            <div><span class="bank-lbl">IFSC Code:</span> <b class="font-mono">${esc(p.bank.ifsc)}</b></div>
            ${p.bank.branch ? `<div><span class="bank-lbl">Branch:</span> ${esc(p.bank.branch)}</div>` : ''}
          </div>
        </div>
      `;
    }
  }

  let qrHtml = '';
  if (cur === 'INR' && p.showQr && p.vpa) {
    const uri = buildUpiUri({
      vpa: p.vpa,
      payeeName: p.payeeName ?? d.company.legalName,
      amount: p.balance,
      docNumber: d.number ?? '',
      trEnabled: p.trEnabled ?? true,
    });
    qrHtml = `
      <div class="qr-box">
        <div class="qr-svg-wrap">${await upiQrSvg(uri)}</div>
        <div class="qr-meta">
          <div class="qr-tag">Scan with any UPI App</div>
          <div class="qr-amt">Pay ${esc(fmt(p.balance))}</div>
          <div class="qr-vpa font-mono">UPI ID: ${esc(p.vpa)}</div>
        </div>
      </div>
    `;
  }

  return `
    <div class="pay-section">
      <div class="pay-header">
        <div class="pay-heading">Commercial Settlement &amp; Payment Options</div>
        <div class="pay-due-badge">
          <span>Amount Payable:</span>
          <b>${esc(fmt(p.balance))}</b>
        </div>
      </div>
      <div class="pay-body">
        ${qrHtml}
        <div class="pay-details">
          ${p.paid ? `<div class="pay-received">Advance / Received so far: <b>${esc(fmt(p.paid))}</b></div>` : ''}
          ${bankHtml}
        </div>
      </div>
    </div>
  `;
}

export async function renderDocumentHtml(d: DocInput): Promise<string> {
  const co = {
    ...DEFAULT_HOPEPITOME_COMPANY,
    ...(d.company || {}),
  };
  // Ensure logoDataUrl is present
  if (!co.logoDataUrl) {
    co.logoDataUrl = HOPEPITOME_LOGO_DATA_URL;
  }

  const cur = d.currency || co.currency || 'INR';
  const sym = CURRENCIES[cur]?.symbol || cur;
  const fmt = (p: Paise) => esc(formatCurrency(p, cur, true));
  const isUae = co.taxRegime === 'AE_VAT';
  const isTaxRegistered = co.taxRegistered !== false;

  const gst = d.kind !== 'bill_of_supply' && d.kind !== 'receipt' && isTaxRegistered && d.taxTreatment !== 'bill_of_supply' && d.taxTreatment !== 'none' && d.lines.some((l) => l.cgst || l.sgst || l.igst);
  const intra = !isUae && d.lines.some((l) => l.cgst || l.sgst);
  const colSpanCount = gst ? (intra ? 10 : 9) : 8;

  const taxHeaders = gst
    ? isUae
      ? '<th class="r">VAT (5%)</th>'
      : intra
      ? '<th class="r">CGST</th><th class="r">SGST</th>'
      : '<th class="r">IGST</th>'
    : '';

  const rows = d.lines
    .map((l, i) => {
      if (l.kind === 'heading') {
        return `
          <tr class="section-row">
            <td colspan="${colSpanCount}">
              <div class="section-heading">${esc(l.description)}</div>
            </td>
          </tr>
        `;
      }
      const taxCols = gst
        ? isUae
          ? `<td class="r font-mono">${(l.igst || l.cgst || l.sgst) ? fmt(l.igst || ((l.cgst || 0) + (l.sgst || 0))) : '—'}</td>`
          : intra
          ? `<td class="r font-mono">${l.cgst ? fmt(l.cgst) : '—'}</td><td class="r font-mono">${l.sgst ? fmt(l.sgst) : '—'}</td>`
          : `<td class="r font-mono">${l.igst ? fmt(l.igst) : '—'}</td>`
        : '';

      return `
        <tr class="item-row ${i % 2 === 1 ? 'row-alt' : ''}">
          <td class="col-num">${i + 1}</td>
          <td class="col-desc">
            <div class="item-name">${nl2br(l.description)}</div>
          </td>
          <td class="col-hsn font-mono">${esc(l.hsnSac || '—')}</td>
          <td class="r col-qty font-mono"><b>${esc(l.qty)}</b> <span class="unit">${esc(l.unit || 'Nos')}</span></td>
          <td class="r col-rate font-mono">${fmt(l.rate)}</td>
          <td class="r col-disc font-mono">${l.discount ? fmt(l.discount) : '—'}</td>
          <td class="r col-taxable font-mono">${fmt(l.taxable)}</td>
          ${taxCols}
          <td class="r col-total font-mono"><b>${fmt(l.total)}</b></td>
        </tr>
      `;
    })
    .join('');

  const t = d.totals;
  const totalsList: [string, number, string?][] = [
    ['Subtotal', t.subTotal],
    t.discountTotal ? ['Total Discount Applied', -t.discountTotal, 'text-green'] : null,
    gst ? ['Net Taxable Value', t.taxable] : null,
    gst && isUae ? ['VAT (5%)', t.igst || (t.cgst || 0) + (t.sgst || 0)] : null,
    gst && !isUae && intra ? ['CGST (Central Tax)', t.cgst] : null,
    gst && !isUae && intra ? ['SGST (State Tax)', t.sgst] : null,
    gst && !isUae && !intra ? ['IGST (Integrated Tax)', t.igst] : null,
    t.roundOff ? ['Round Off', t.roundOff] : null,
  ].filter(Boolean) as [string, number, string?][];

  const posName = d.placeOfSupply
    ? d.placeOfSupply === '96'
      ? 'Outside India (96)'
      : `${GST_STATES[d.placeOfSupply] ?? ''} (${d.placeOfSupply})`
    : '';

  const metaList = [
    ['Document Number', d.number ? `<b>${esc(d.number)}</b>` : '<span class="status-draft">DRAFT</span>'],
    ['Issue Date', `<b>${displayDate(d.date)}</b>`],
    d.dueDate ? ['Due Date', `<b>${displayDate(d.dueDate)}</b>`] : null,
    d.validUntil ? ['Valid Until', `<b>${displayDate(d.validUntil)}</b>`] : null,
    d.expectedDelivery ? ['Expected Delivery', `<b>${displayDate(d.expectedDelivery)}</b>`] : null,
    posName ? ['Place of Supply', `<b>${esc(posName)}</b>`] : null,
    cur !== 'INR' ? ['Currency', `<b>${esc(cur)} (${esc(sym)})</b>`] : null,
    cur !== 'INR' && d.exchangeRate ? ['Exchange Rate', `<b>1 ${esc(cur)} = ₹${esc(d.exchangeRate)}</b>`] : null,
    d.taxTreatment === 'export_lut' || d.taxTreatment === 'sez_lut' ? ['LUT Status', '<b>Zero-Rated under LUT</b>'] : null,
    co.lutNumber ? ['LUT No.', `<b>${esc(co.lutNumber)}</b>`] : null,
    ...(d.refs ?? []).map((r) => [r.label, `<b>${esc(r.value)}</b>`]),
  ].filter(Boolean) as [string, string][];

  const receiptHtml = d.receipt
    ? `
      <div class="receipt-card">
        <div class="receipt-header">Settlement Allocations</div>
        <table class="items-table">
          <thead>
            <tr><th>Invoice / Reference Number</th><th class="r">Settled Amount</th></tr>
          </thead>
          <tbody>
            ${d.receipt.allocations.map((a) => `<tr><td class="font-mono"><b>${esc(a.number)}</b></td><td class="r font-mono">${esc(formatCurrency(a.amount, d.receipt?.currency || cur, true))}</td></tr>`).join('')}
          </tbody>
        </table>
        <div class="receipt-summary">
          <div>Received <b>${esc(formatCurrency(d.receipt.amount, d.receipt.currency || cur, true))}</b> via <b>${esc(d.receipt.mode.toUpperCase())}</b>${d.receipt.reference ? ` (Ref: <span class="font-mono">${esc(d.receipt.reference)}</span>)` : ''}${d.receipt.tds ? `; TDS withheld ${esc(formatCurrency(d.receipt.tds, d.receipt.currency || cur, true))}` : ''}.</div>
        </div>
        ${d.receipt.cancelledReason ? `<div class="stamp-cancelled">CANCELLED — ${esc(d.receipt.cancelledReason)}</div>` : ''}
      </div>
    `
    : '';

  const docTitle = d.title || TITLES[d.kind] || 'DOCUMENT';
  let docSubtitle = d.subtitle;
  if (!docSubtitle) {
    if (d.taxTreatment === 'export_lut') {
      docSubtitle = 'Supply meant for export under LUT without payment of integrated tax';
    } else if (d.taxTreatment === 'export_igst') {
      docSubtitle = 'Supply meant for export on payment of integrated tax';
    } else if (d.taxTreatment === 'sez_lut') {
      docSubtitle = 'Supply to SEZ unit/developer under LUT without payment of integrated tax';
    } else if (d.taxTreatment === 'sez_igst') {
      docSubtitle = 'Supply to SEZ unit/developer on payment of integrated tax';
    } else if (d.taxTreatment === 'bill_of_supply' || !isTaxRegistered) {
      docSubtitle = 'Supply of Goods / Services (Bill of Supply)';
    } else {
      docSubtitle = SUBTITLES[d.kind] || '';
    }
  }

  const words = d.totals.inWords || currencyAmountInWords(d.totals.grandTotal, cur);

  // INR conversion display for Indian GST foreign currency documents
  const showInrConversion = cur !== 'INR' && co.taxRegime === 'IN_GST';
  const inrConversionHtml = showInrConversion
    ? `
      <div class="inr-conversion-card" style="margin-top: 10px; padding: 10px 14px; background: #F8FAFC; border: 1px solid #CBD5E1; border-radius: 6px;">
        <div style="font-weight: 700; color: #1E293B; font-size: 11px; margin-bottom: 4px;">Indian GST Statutory Currency Conversion (CBIC Rate)</div>
        <div style="display: flex; gap: 16px; flex-wrap: wrap; font-size: 10px; color: #334155;">
          <div>Exchange Rate: <b>1 ${esc(cur)} = ₹${esc(d.exchangeRate || 1)}</b></div>
          <div>Taxable: <b class="font-mono">${esc(formatCurrency(d.baseTotals?.taxable || Math.round(t.taxable * (d.exchangeRate || 1)), 'INR', true))}</b></div>
          <div>Integrated Tax: <b class="font-mono">${esc(formatCurrency(d.baseTotals?.igst || Math.round((t.igst || (t.cgst || 0) + (t.sgst || 0)) * (d.exchangeRate || 1)), 'INR', true))}</b></div>
          <div>Grand Total: <b class="font-mono">${esc(formatCurrency(d.baseTotals?.grandTotal || Math.round(t.grandTotal * (d.exchangeRate || 1)), 'INR', true))}</b></div>
        </div>
      </div>
    `
    : '';

  return `<!doctype html>
<html lang="en-IN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(docTitle)} ${esc(d.number ?? '')} — ${esc(co.legalName)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>${DOCUMENT_CSS}</style>
</head>
<body>
  <div class="doc-sheet">
    <!-- Top Vibrant Brand Accent Bar -->
    <div class="brand-ribbon"></div>

    <!-- 1. Header with HopEpitome Logo & Document Title -->
    <header class="header-band">
      <div class="brand-col">
        <div class="logo-box">
          <img class="logo-img" src="${esc(co.logoDataUrl)}" alt="${esc(co.legalName)}">
        </div>
        <div class="company-text">
          <h1 class="company-name">${esc(co.legalName)}</h1>
          ${co.tagline ? `<div class="company-tagline">${esc(co.tagline)}</div>` : ''}
          <div class="company-details">
            <div>${nl2br(co.address)}</div>
            <div class="company-contacts">
              ${isTaxRegistered && co.gstin ? `<span class="gst-badge"><span class="badge-dot"></span>GSTIN: <b>${esc(co.gstin)}</b></span>` : ''}
              ${isTaxRegistered && co.trn ? `<span class="gst-badge"><span class="badge-dot"></span>TRN: <b>${esc(co.trn)}</b></span>` : ''}
              ${co.pan ? `<span>PAN: <b>${esc(co.pan)}</b></span>` : ''}
              ${co.phone ? `<span>📞 ${esc(co.phone)}</span>` : ''}
              ${co.email ? `<span>✉️ ${esc(co.email)}</span>` : ''}
              ${co.website ? `<span>🌐 <b>${esc(co.website)}</b></span>` : ''}
            </div>
          </div>
        </div>
      </div>

      <div class="title-col">
        <div class="doc-badge-wrap">
          <span class="doc-type-pill doc-type-${d.kind}">${esc(docTitle)}</span>
          ${d.copy ? `<span class="doc-copy-tag">${esc(d.copy)}</span>` : ''}
        </div>
        <div class="doc-number-display font-mono">${d.number ? esc(d.number) : 'DRAFT'}</div>
        <div class="doc-subtitle">${esc(docSubtitle)}</div>
      </div>
    </header>

    <!-- 2. Address & Document Scope Cards -->
    <section class="meta-section">
      <!-- Bill To Card -->
      <div class="meta-card">
        <div class="card-tag">Bill To / Client Scope</div>
        <div class="party-name">${esc(d.billTo.name)}</div>
        ${d.billTo.company && d.billTo.company !== d.billTo.name ? `<div class="party-company">${esc(d.billTo.company)}</div>` : ''}
        <div class="party-address">${nl2br(d.billTo.address || [d.billTo.city, d.billTo.state, d.billTo.country].filter(Boolean).join(', ') || 'Address on file')}</div>
        ${d.billTo.gstin ? `<div class="party-gst font-mono"><b>GSTIN:</b> ${esc(d.billTo.gstin)}</div>` : ''}
        ${d.billTo.trn ? `<div class="party-gst font-mono"><b>TRN:</b> ${esc(d.billTo.trn)}</div>` : ''}
        ${d.billTo.taxId && !d.billTo.gstin && !d.billTo.trn ? `<div class="party-gst font-mono"><b>Tax ID:</b> ${esc(d.billTo.taxId)}</div>` : ''}
        ${d.billTo.phone || d.billTo.email ? `<div class="party-contact">${[d.billTo.phone, d.billTo.email].filter(Boolean).map(esc).join(' · ')}</div>` : ''}
      </div>

      <!-- Ship To / Deliverable Scope Card -->
      ${
        d.shipTo
          ? `
        <div class="meta-card">
          <div class="card-tag">Ship To / Delivery Destination</div>
          <div class="party-name">${esc(d.shipTo.name)}</div>
          <div class="party-address">${nl2br(d.shipTo.address || [d.shipTo.city, d.shipTo.state, d.shipTo.country].filter(Boolean).join(', ') || 'Same as billing address')}</div>
          ${d.shipTo.gstin ? `<div class="party-gst font-mono"><b>GSTIN:</b> ${esc(d.shipTo.gstin)}</div>` : ''}
          ${d.shipTo.trn ? `<div class="party-gst font-mono"><b>TRN:</b> ${esc(d.shipTo.trn)}</div>` : ''}
        </div>
      `
          : ''
      }

      <!-- Metadata Properties Grid -->
      <div class="meta-card meta-dates-card">
        <div class="card-tag">Schedule &amp; References</div>
        <table class="dates-table font-mono">
          <tbody>
            ${metaList.map(([k, v]) => `<tr><td class="date-lbl">${esc(k)}:</td><td class="date-val">${v}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>
    </section>

    <!-- 3. Line Items Commercial Table or Receipt Details -->
    ${
      d.kind === 'receipt'
        ? receiptHtml
        : `
      <div class="table-container">
        <table class="items-table">
          <thead>
            <tr>
              <th class="col-num">#</th>
              <th class="col-desc">Scope &amp; Deliverables Description</th>
              <th class="col-hsn">HSN/SAC</th>
              <th class="r col-qty">Qty</th>
              <th class="r col-rate">Unit Rate</th>
              <th class="r col-disc">Disc.</th>
              <th class="r col-taxable">Taxable</th>
              ${taxHeaders}
              <th class="r col-total">Total (${esc(sym)})</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>

      <!-- 4. Summary & Commercial Totals -->
      <section class="summary-section">
        <div class="words-container">
          <div class="words-box">
            <div class="words-tag">Total Amount in Words</div>
            <div class="words-text">${esc(words)}</div>
          </div>

          ${inrConversionHtml}

          <div class="compliance-badge">
            <span class="compliance-shield">🛡️</span>
            <div>
              <div class="compliance-title">HopEpitome Verified &amp; Digitally Authenticated</div>
              <div class="compliance-sub">Electronic commercial documentation generated under legal compliance standards.</div>
            </div>
          </div>
        </div>

        <div class="totals-container">
          <table class="totals-table">
            <tbody>
              ${totalsList
                .map(
                  ([label, amount, cls]) => `
                <tr class="${cls || ''}">
                  <td class="tot-label">${esc(label)}</td>
                  <td class="tot-val font-mono">${amount < 0 ? `-${fmt(Math.abs(amount))}` : fmt(amount)}</td>
                </tr>
              `
                )
                .join('')}
              <tr class="grand-total-row">
                <td class="grand-label">Grand Total</td>
                <td class="grand-val font-mono">${fmt(t.grandTotal)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    `
    }

    <!-- 5. Payment, Banking & QR Settlement Options -->
    ${await paymentBlock(d)}

    <!-- 6. Terms & Conditions and Notes -->
    <div class="terms-notes-section">
      ${
        d.terms
          ? `
        <div class="terms-box">
          <div class="section-tag">Terms &amp; Commercial Conditions</div>
          <div class="terms-content">${nl2br(d.terms)}</div>
        </div>
      `
          : ''
      }
      ${
        d.notes
          ? `
        <div class="notes-box">
          <div class="section-tag">Special Instructions &amp; Notes</div>
          <div class="notes-content">${nl2br(d.notes)}</div>
        </div>
      `
          : ''
      }
    </div>

    <!-- 7. Authorised Signatory Block -->
    <section class="signatory-section">
      <div class="signatory-declaration">
        ${d.kind === 'tax_invoice' ? 'Certified that the particulars given above are true and correct. ' : ''}
        ${co.jurisdiction ? `Subject to <b>${esc(co.jurisdiction)}</b> jurisdiction. ` : ''}
      </div>

      <div class="signatory-box">
        <div class="signatory-for">For <b>${esc(co.legalName)}</b></div>
        <div class="signatory-seal-box">
          <div class="digital-seal">HopEpitome · DIGITAL SIGNATURE</div>
        </div>
        <div class="signatory-line">${esc(co.signatory ?? 'Authorised Signatory')}</div>
      </div>
    </section>

    <!-- 8. Document Footer -->
    <footer class="doc-footer">
      <div>We build digital systems for businesses and distinctive professional identities for people.</div>
      <div class="footer-links">
        <span><b>${esc(co.website ?? 'hopepitome.com')}</b></span> · 
        <span>${esc(co.email ?? 'service@hopepitome.com')}</span> · 
        <span>Bangalore, Karnataka, India</span>
        ${d.poweredBy ? ' · <i>Powered by SaleSphere</i>' : ''}
      </div>
    </footer>
  </div>
</body>
</html>`;
}

export const DOCUMENT_CSS = `
@page {
  size: A4 portrait;
  margin: 10mm 12mm 12mm 12mm;
}

*, *::before, *::after {
  box-sizing: border-box;
}

body {
  margin: 0;
  padding: 0;
  background-color: #EDF2F7;
  color: #0F172A;
  font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  font-size: 10.5px;
  line-height: 1.45;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.font-mono {
  font-family: 'JetBrains Mono', 'Fira Code', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.doc-sheet {
  background: #ffffff;
  max-width: 210mm;
  min-height: 297mm;
  margin: 0 auto;
  padding: 14mm 16mm;
  position: relative;
  box-shadow: 0 10px 30px -5px rgba(15, 23, 42, 0.1);
}

@media print {
  body {
    background: #ffffff;
  }
  .doc-sheet {
    box-shadow: none;
    margin: 0;
    padding: 0;
    max-width: none;
    min-height: auto;
  }
}

/* Top Vibrant Dual Accent Ribbon */
.brand-ribbon {
  height: 5px;
  background: linear-gradient(90deg, #1F51FF 0%, #3B82F6 40%, #10B981 100%);
  border-radius: 4px;
  margin-bottom: 14px;
}

/* 1. Header Band */
.header-band {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  padding-bottom: 14px;
  border-bottom: 1.5px solid #E2E8F0;
}

.brand-col {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  flex: 1;
}

.logo-box {
  flex-shrink: 0;
}

.logo-img {
  max-height: 52px;
  max-width: 170px;
  object-fit: contain;
  display: block;
}

.company-text {
  flex: 1;
}

.company-name {
  margin: 0;
  font-size: 17px;
  font-weight: 800;
  color: #0A0B0D;
  letter-spacing: -0.02em;
}

.company-tagline {
  font-size: 10px;
  font-weight: 600;
  color: #1F51FF;
  margin-top: 1px;
  letter-spacing: -0.01em;
}

.company-details {
  font-size: 9.5px;
  color: #475569;
  margin-top: 4px;
  line-height: 1.4;
}

.company-contacts {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
  font-size: 9px;
  color: #64748B;
}

.gst-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: #F1F5F9;
  color: #1E293B;
  padding: 1.5px 6px;
  border-radius: 4px;
  border: 1px solid #CBD5E1;
}

.badge-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #10B981;
}

.title-col {
  text-align: right;
  flex-shrink: 0;
}

.doc-badge-wrap {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  margin-bottom: 4px;
}

.doc-type-pill {
  display: inline-block;
  padding: 3.5px 12px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #ffffff;
  border-radius: 6px;
  background: linear-gradient(135deg, #1F51FF 0%, #1642E2 100%);
  box-shadow: 0 2px 6px rgba(31, 81, 255, 0.25);
}

.doc-type-order {
  background: linear-gradient(135deg, #059669 0%, #047857 100%);
}

.doc-type-receipt {
  background: linear-gradient(135deg, #0284C7 0%, #0369A1 100%);
}

.doc-type-credit_note {
  background: linear-gradient(135deg, #DC2626 0%, #B91C1C 100%);
}

.doc-copy-tag {
  font-size: 9px;
  font-weight: 700;
  color: #64748B;
  background: #F1F5F9;
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid #E2E8F0;
}

.doc-number-display {
  font-size: 15px;
  font-weight: 800;
  color: #0F172A;
  margin: 3px 0 2px 0;
}

.doc-subtitle {
  font-size: 9.5px;
  color: #64748B;
}

.status-draft {
  color: #D97706;
  font-weight: 800;
}

/* 2. Addresses & Scope Cards */
.meta-section {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
  margin: 12px 0 14px 0;
}

.meta-card {
  background: #F8FAFC;
  border: 1px solid #E2E8F0;
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 9.5px;
}

.card-tag {
  font-size: 8.5px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #1F51FF;
  margin-bottom: 5px;
}

.party-name {
  font-size: 12px;
  font-weight: 800;
  color: #0F172A;
}

.party-company {
  font-size: 10.5px;
  font-weight: 600;
  color: #475569;
}

.party-address {
  color: #64748B;
  margin-top: 3px;
  line-height: 1.35;
}

.party-gst {
  margin-top: 4px;
  color: #1E293B;
  font-size: 9.5px;
}

.party-contact {
  margin-top: 3px;
  color: #64748B;
  font-size: 9px;
}

.dates-table {
  width: 100%;
  border-collapse: collapse;
}

.dates-table td {
  padding: 2px 0;
  font-size: 9.5px;
}

.date-lbl {
  color: #64748B;
  padding-right: 8px;
  white-space: nowrap;
}

.date-val {
  text-align: right;
  color: #0F172A;
}

/* 3. Table of Deliverables */
.table-container {
  margin-top: 10px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #CBD5E1;
}

.items-table {
  width: 100%;
  border-collapse: collapse;
}

thead{display:table-header-group}
.items-table thead {
  display: table-header-group;
}

.items-table th {
  background: #0F172A;
  color: #ffffff;
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 7px 8px;
  text-align: left;
  border-bottom: 2px solid #1F51FF;
}

.items-table td {
  padding: 6.5px 8px;
  border-bottom: 1px solid #E2E8F0;
  vertical-align: middle;
  font-size: 9.5px;
}

.item-row:hover {
  background-color: #F8FAFC;
}

.row-alt {
  background-color: #FAFAFC;
}

.col-num {
  width: 28px;
  text-align: center;
  color: #64748B;
}

.col-desc {
  min-width: 180px;
}

.item-name {
  font-weight: 600;
  color: #0F172A;
}

.col-hsn {
  color: #475569;
  font-size: 9px;
}

.col-qty {
  white-space: nowrap;
}

.unit {
  font-size: 8.5px;
  color: #64748B;
}

.col-rate, .col-disc, .col-taxable, .col-total {
  white-space: nowrap;
}

.section-row td {
  background: #EEF2FF;
  border-top: 1.5px solid #C7D2FE;
  border-bottom: 1.5px solid #C7D2FE;
  padding: 6px 10px;
}

.section-heading {
  font-weight: 800;
  font-size: 10px;
  color: #1F51FF;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.r {
  text-align: right;
}

/* 4. Financial Summary Section */
.summary-section {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  margin-top: 10px;
  page-break-inside: avoid;
}

.words-container {
  flex: 1;
  display: flex;
  flex-col;
  justify-content: space-between;
  gap: 10px;
}

.words-box {
  background: #F8FAFC;
  border: 1px solid #E2E8F0;
  border-left: 3px solid #1F51FF;
  border-radius: 6px;
  padding: 8px 10px;
}

.words-tag {
  font-size: 8.5px;
  font-weight: 800;
  text-transform: uppercase;
  color: #64748B;
  letter-spacing: 0.05em;
  margin-bottom: 2px;
}

.words-text {
  font-size: 10px;
  font-weight: 700;
  color: #1E293B;
  line-height: 1.35;
}

.compliance-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  background: #ECFDF5;
  border: 1px solid #A7F3D0;
  border-radius: 6px;
  font-size: 9px;
}

.compliance-shield {
  font-size: 14px;
}

.compliance-title {
  font-weight: 700;
  color: #065F46;
}

.compliance-sub {
  color: #047857;
  font-size: 8px;
}

.totals-container {
  width: 250px;
  flex-shrink: 0;
}

.totals-table {
  width: 100%;
  border-collapse: collapse;
}

.totals-table td {
  padding: 3px 6px;
  font-size: 9.5px;
}

.tot-label {
  color: #475569;
}

.tot-val {
  text-align: right;
  font-weight: 600;
  color: #0F172A;
}

.text-green {
  color: #059669;
}

.grand-total-row td {
  padding: 7px 8px;
  border-top: 2px solid #0F172A;
  background: #0F172A;
  color: #ffffff;
  border-radius: 4px;
}

.grand-label {
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.grand-val {
  font-size: 14px;
  font-weight: 800;
  text-align: right;
  color: #34D399;
}

/* 5. Payment & Settlement Box */
.pay-section {
  margin-top: 12px;
  border: 1px solid #CBD5E1;
  border-radius: 8px;
  background: #FAFAFC;
  padding: 10px 12px;
  page-break-inside: avoid;
}

.pay-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #E2E8F0;
  padding-bottom: 6px;
  margin-bottom: 8px;
}

.pay-heading {
  font-size: 10px;
  font-weight: 800;
  color: #0F172A;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.pay-due-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
  color: #1F51FF;
}

.pay-body {
  display: flex;
  align-items: center;
  gap: 16px;
}

.qr-box {
  display: flex;
  align-items: center;
  gap: 10px;
  background: #ffffff;
  border: 1px solid #E2E8F0;
  border-radius: 6px;
  padding: 6px 8px;
  flex-shrink: 0;
}

.qr-svg-wrap svg {
  width: 90px;
  height: 90px;
  display: block;
}

.qr-meta {
  font-size: 8.5px;
}

.qr-tag {
  font-weight: 700;
  color: #1F51FF;
  text-transform: uppercase;
}

.qr-amt {
  font-size: 11px;
  font-weight: 800;
  color: #0F172A;
  margin: 1px 0;
}

.qr-vpa {
  color: #64748B;
}

.pay-details {
  flex: 1;
}

.pay-received {
  font-size: 9.5px;
  color: #059669;
  margin-bottom: 4px;
}

.bank-box {
  font-size: 9px;
  background: #ffffff;
  border: 1px solid #E2E8F0;
  border-radius: 6px;
  padding: 6px 8px;
}

.bank-title {
  font-weight: 700;
  color: #1E293B;
  margin-bottom: 3px;
}

.bank-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 3px 8px;
}

.bank-lbl {
  color: #64748B;
}

/* Paid Seal */
.pay-paid {
  display: flex;
  align-items: center;
  gap: 16px;
  background: #ECFDF5;
  border: 1px solid #6EE7B7;
}

.stamp-paid {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 2px solid #059669;
  color: #059669;
  font-weight: 800;
  font-size: 15px;
  padding: 4px 12px;
  border-radius: 6px;
  letter-spacing: 0.05em;
  transform: rotate(-3deg);
}

.stamp-icon {
  font-size: 18px;
}

.pay-paid-title {
  font-size: 11px;
  font-weight: 700;
  color: #065F46;
}

.pay-paid-sub {
  font-size: 9px;
  color: #047857;
}

/* 6. Terms & Notes */
.terms-notes-section {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 10px;
  font-size: 9px;
}

.terms-box, .notes-box {
  background: #F8FAFC;
  border: 1px solid #E2E8F0;
  border-radius: 6px;
  padding: 8px 10px;
}

.section-tag {
  font-size: 8.5px;
  font-weight: 800;
  color: #475569;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 3px;
}

.terms-content, .notes-content {
  color: #475569;
  line-height: 1.4;
}

/* 7. Signatory Section */
.signatory-section {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-top: 14px;
  padding-top: 8px;
  border-top: 1px dashed #CBD5E1;
  page-break-inside: avoid;
}

.signatory-declaration {
  flex: 1;
  font-size: 8.5px;
  color: #64748B;
  max-width: 380px;
  line-height: 1.4;
}

.signatory-box {
  text-align: right;
}

.signatory-for {
  font-size: 9.5px;
  color: #334155;
  margin-bottom: 4px;
}

.signatory-seal-box {
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.digital-seal {
  font-size: 8px;
  font-weight: 700;
  color: #1F51FF;
  border: 1px dashed #93C5FD;
  padding: 2px 8px;
  border-radius: 4px;
  background: #EFF6FF;
}

.signatory-line {
  border-top: 1.5px solid #0F172A;
  display: inline-block;
  min-width: 170px;
  padding-top: 3px;
  font-weight: 700;
  font-size: 9.5px;
  color: #0F172A;
}

/* 8. Footer */
.doc-footer {
  margin-top: 14px;
  padding-top: 8px;
  border-top: 1px solid #E2E8F0;
  text-align: center;
  font-size: 8.5px;
  color: #64748B;
  line-height: 1.4;
}

.footer-links {
  margin-top: 2px;
  color: #94A3B8;
}

.footer-links span b {
  color: #1F51FF;
}

/* Receipt Styles */
.receipt-card {
  margin-top: 10px;
  border: 1px solid #E2E8F0;
  border-radius: 8px;
  overflow: hidden;
}

.receipt-header {
  background: #0F172A;
  color: #ffffff;
  padding: 6px 10px;
  font-size: 9.5px;
  font-weight: 700;
  text-transform: uppercase;
}

.receipt-summary {
  background: #F8FAFC;
  padding: 8px 10px;
  font-size: 9.5px;
  color: #1E293B;
  border-top: 1px solid #E2E8F0;
}

.stamp-cancelled {
  margin: 10px;
  border: 2px solid #DC2626;
  color: #DC2626;
  padding: 6px 12px;
  font-weight: 800;
  font-size: 13px;
  text-align: center;
  border-radius: 6px;
}
`;
