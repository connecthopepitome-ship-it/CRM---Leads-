import QRCode from 'qrcode';
import { buildUpiUri, displayDate, formatINR, GST_STATES, paymentBlockMode, type Paise } from '@ss/domain';

/** Shared A4 document layout (FR-055, FR-067, FR-072, ADR-009). Pure HTML + CSS; rendered to PDF by headless Chromium. */

export interface DocCompany {
  legalName: string;
  address: string;
  gstin?: string | null;
  stateCode: string;
  phone?: string | null;
  email?: string | null;
  jurisdiction?: string | null;
  signatory?: string | null;
  logoDataUrl?: string | null;
}
export interface DocParty {
  name: string;
  address?: string | null;
  gstin?: string | null;
  stateCode?: string | null;
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
  kind: 'quotation' | 'tax_invoice' | 'bill_of_supply' | 'proforma' | 'credit_note' | 'receipt';
  copy?: 'ORIGINAL' | 'DUPLICATE';
  number: string | null;
  date: string;
  dueDate?: string | null;
  validUntil?: string | null;
  refs?: { label: string; value: string }[];
  placeOfSupply?: string | null;
  company: DocCompany;
  billTo: DocParty;
  shipTo?: DocParty | null;
  lines: DocLine[];
  totals: DocTotalsView;
  terms?: string | null;
  notes?: string | null;
  payment?: {
    balance: Paise;
    paid: Paise;
    vpa?: string | null;
    payeeName?: string | null;
    trEnabled?: boolean;
    bank?: { name: string; accountNo: string; ifsc: string; branch?: string } | null;
    showQr: boolean;
  } | null;
  receipt?: { amount: Paise; mode: string; reference?: string | null; tds: Paise; allocations: { number: string; amount: Paise }[]; cancelledReason?: string | null } | null;
  poweredBy?: boolean;
}

const TITLES: Record<DocInput['kind'], string> = {
  quotation: 'QUOTATION', tax_invoice: 'TAX INVOICE', bill_of_supply: 'BILL OF SUPPLY', proforma: 'PROFORMA INVOICE',
  credit_note: 'CREDIT NOTE', receipt: 'PAYMENT RECEIPT',
};

export function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);
}
const m = (p: Paise) => esc(formatINR(p, false));
const nl2br = (s: string) => esc(s).replace(/\n/g, '<br>');

export async function upiQrSvg(uri: string): Promise<string> {
  return QRCode.toString(uri, { type: 'svg', errorCorrectionLevel: 'M', margin: 1, width: 132 });
}

async function paymentBlock(d: DocInput): Promise<string> {
  const p = d.payment;
  if (!p) return '';
  const modeName = paymentBlockMode(p.balance, !!(p.vpa && p.showQr), !!p.bank);
  if (modeName === 'paid') return `<div class="pay paid"><div class="stamp">PAID</div><div>Received ${m(p.paid)} · Thank you</div></div>`;
  const bank = p.bank ? `<div class="bank"><b>Bank transfer</b><br>${esc(p.bank.name)}<br>A/c ${esc(p.bank.accountNo)} · IFSC ${esc(p.bank.ifsc)}${p.bank.branch ? `<br>${esc(p.bank.branch)}` : ''}</div>` : '';
  let qr = '';
  if (modeName === 'qr' && p.vpa) {
    const uri = buildUpiUri({ vpa: p.vpa, payeeName: p.payeeName ?? d.company.legalName, amount: p.balance, docNumber: d.number ?? '', trEnabled: p.trEnabled ?? true });
    qr = `<div class="qr">${await upiQrSvg(uri)}<div class="qr-amt">Scan to pay ₹${m(p.balance)}</div><div class="muted">UPI: ${esc(p.vpa)}</div></div>`;
  }
  return `<div class="pay">${qr}<div><div><b>Balance due: ₹${m(p.balance)}</b></div>${p.paid ? `<div class="muted">Received so far ₹${m(p.paid)}</div>` : ''}${bank}</div></div>`;
}

export async function renderDocumentHtml(d: DocInput): Promise<string> {
  const gst = d.kind !== 'bill_of_supply' && d.kind !== 'receipt' && d.lines.some((l) => l.cgst || l.sgst || l.igst);
  const intra = d.lines.some((l) => l.cgst || l.sgst);
  const taxCols = gst ? (intra ? '<th>CGST</th><th>SGST</th>' : '<th>IGST</th>') : '';
  const rows = d.lines.map((l, i) => {
    if (l.kind === 'heading') return `<tr class="heading"><td colspan="${gst ? (intra ? 9 : 8) : 7}">${esc(l.description)}</td></tr>`;
    const tax = gst ? (intra ? `<td class="r">${m(l.cgst)}</td><td class="r">${m(l.sgst)}</td>` : `<td class="r">${m(l.igst)}</td>`) : '';
    return `<tr><td>${i + 1}</td><td>${nl2br(l.description)}</td><td>${esc(l.hsnSac ?? '')}</td><td class="r">${esc(l.qty)} ${esc(l.unit ?? '')}</td><td class="r">${m(l.rate)}</td><td class="r">${l.discount ? m(l.discount) : ''}</td><td class="r">${m(l.taxable)}</td>${tax}</tr>`;
  }).join('');
  const t = d.totals;
  const totals = [
    ['Sub-total', t.subTotal],
    t.discountTotal ? ['Discount', -t.discountTotal] : null,
    gst ? ['Taxable value', t.taxable] : null,
    gst && intra ? ['CGST', t.cgst] : null,
    gst && intra ? ['SGST', t.sgst] : null,
    gst && !intra ? ['IGST', t.igst] : null,
    t.roundOff ? ['Round-off', t.roundOff] : null,
  ].filter(Boolean) as [string, number][];
  const pos = d.placeOfSupply ? `${GST_STATES[d.placeOfSupply] ?? ''} (${d.placeOfSupply})` : '';
  const meta = [
    d.number ? ['Number', d.number] : ['Status', 'DRAFT'],
    ['Date', displayDate(d.date)],
    d.dueDate ? ['Due date', displayDate(d.dueDate)] : null,
    d.validUntil ? ['Valid until', displayDate(d.validUntil)] : null,
    pos ? ['Place of supply', pos] : null,
    ...(d.refs ?? []).map((r) => [r.label, r.value]),
  ].filter(Boolean) as [string, string][];
  const receipt = d.receipt
    ? `<table class="items"><thead><tr><th>Applied to</th><th class="r">Amount</th></tr></thead><tbody>${d.receipt.allocations.map((a) => `<tr><td>${esc(a.number)}</td><td class="r">${m(a.amount)}</td></tr>`).join('')}</tbody></table>
       <p>Received ₹${m(d.receipt.amount)} by ${esc(d.receipt.mode.toUpperCase())}${d.receipt.reference ? ` (ref ${esc(d.receipt.reference)})` : ''}${d.receipt.tds ? `; TDS deducted ₹${m(d.receipt.tds)}` : ''}.</p>
       ${d.receipt.cancelledReason ? `<div class="stamp cancelled">CANCELLED — ${esc(d.receipt.cancelledReason)}</div>` : ''}`
    : '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(TITLES[d.kind])} ${esc(d.number ?? '')}</title><style>${CSS}</style></head><body>
<header class="band"><div class="co">${d.company.logoDataUrl ? `<img class="logo" src="${esc(d.company.logoDataUrl)}" alt="">` : ''}<div><div class="name">${esc(d.company.legalName)}</div><div class="muted">${nl2br(d.company.address)}</div>
<div class="muted">${d.company.gstin ? `GSTIN ${esc(d.company.gstin)} · ` : ''}${esc(d.company.phone ?? '')} ${esc(d.company.email ?? '')}</div></div></div>
<div class="title"><div class="doc">${esc(TITLES[d.kind])}</div>${d.copy ? `<div class="muted">${esc(d.copy)} FOR RECIPIENT</div>` : ''}</div></header>
<section class="meta"><div class="party"><div class="label">Bill to</div><b>${esc(d.billTo.name)}</b><div>${nl2br(d.billTo.address ?? '')}</div>${d.billTo.gstin ? `<div>GSTIN ${esc(d.billTo.gstin)}</div>` : ''}</div>
${d.shipTo ? `<div class="party"><div class="label">Ship to</div><b>${esc(d.shipTo.name)}</b><div>${nl2br(d.shipTo.address ?? '')}</div></div>` : ''}
<table class="kv">${meta.map(([k, v]) => `<tr><td class="muted">${esc(k)}</td><td><b>${esc(v)}</b></td></tr>`).join('')}</table></section>
${d.kind === 'receipt' ? receipt : `<table class="items"><thead><tr><th>#</th><th>Description</th><th>HSN/SAC</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">Disc.</th><th class="r">Taxable</th>${taxCols}</tr></thead><tbody>${rows}</tbody></table>
<section class="sum"><div class="words"><div class="label">Amount in words</div>${esc(t.inWords)}</div><table class="kv tot">${totals.map(([k, v]) => `<tr><td>${esc(k)}</td><td class="r">${m(v)}</td></tr>`).join('')}<tr class="grand"><td>Total</td><td class="r">₹${m(t.grandTotal)}</td></tr></table></section>`}
${await paymentBlock(d)}
${d.terms ? `<section class="terms"><div class="label">Terms &amp; conditions</div>${nl2br(d.terms)}</section>` : ''}
${d.notes ? `<section class="terms"><div class="label">Notes</div>${nl2br(d.notes)}</section>` : ''}
<section class="sign"><div>For ${esc(d.company.legalName)}</div><div class="line">${esc(d.company.signatory ?? 'Authorised signatory')}</div></section>
<footer>${d.kind === 'tax_invoice' ? 'Certified that the particulars given above are true and correct. ' : ''}${d.company.jurisdiction ? `Subject to ${esc(d.company.jurisdiction)} jurisdiction. ` : ''}Thank you for your business.${d.poweredBy ? ' · Powered by SaleSphere' : ''}</footer>
</body></html>`;
}

const CSS = `@page{size:A4;margin:14mm 12mm 18mm}
*{box-sizing:border-box}body{font-family:Inter,"Noto Sans","Noto Sans Devanagari","Noto Sans Tamil",Arial,sans-serif;font-size:10.5px;color:#0f172a;margin:0}
.band{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #2563EB;padding-bottom:8px}
.co{display:flex;gap:10px}.logo{max-height:48px;max-width:140px}.name{font-size:15px;font-weight:700}.muted{color:#475569}
.title{text-align:right}.doc{font-size:17px;font-weight:700;color:#1d4ed8;letter-spacing:.04em}
.meta{display:flex;gap:16px;justify-content:space-between;margin:12px 0}.party{flex:1}.label{font-size:9px;text-transform:uppercase;color:#64748b;letter-spacing:.06em;margin-bottom:2px}
table{border-collapse:collapse}.kv td{padding:1px 6px}.items{width:100%;margin-top:6px}.items thead{display:table-header-group}
.items th{background:#eff6ff;text-align:left;padding:5px;border-bottom:1px solid #93c5fd;font-weight:600}.items td{padding:5px;border-bottom:1px solid #e2e8f0;vertical-align:top}
.items tr{page-break-inside:avoid}.heading td{font-weight:700;background:#f8fafc}.r{text-align:right}
.sum{display:flex;justify-content:space-between;gap:16px;margin-top:8px}.words{flex:1}.tot td{padding:2px 6px}.grand td{font-weight:700;font-size:12px;border-top:2px solid #0f172a}
.pay{display:flex;gap:16px;align-items:center;border:1px solid #cbd5e1;border-radius:6px;padding:10px;margin-top:12px;page-break-inside:avoid}.qr svg{width:120px;height:120px}.qr-amt{font-weight:700;text-align:center}
.paid{justify-content:flex-start}.stamp{border:3px solid #15803d;color:#15803d;font-weight:800;font-size:20px;padding:4px 14px;transform:rotate(-6deg);display:inline-block}
.stamp.cancelled{border-color:#b91c1c;color:#b91c1c;font-size:14px}.bank{margin-top:6px}
.terms{margin-top:12px}.sign{margin-top:28px;text-align:right}.sign .line{margin-top:30px;border-top:1px solid #94a3b8;display:inline-block;padding-top:2px;min-width:160px}
footer{margin-top:16px;color:#64748b;font-size:9px;text-align:center}`;

export { CSS as DOCUMENT_CSS };
