import express, { Router } from 'express';
import ExcelJS from 'exceljs';
import { RespondBody, ShareLinkBody, ShareLinkPatchBody } from '@ss/contracts';
import { renderDocumentHtml, type DocInput } from '@ss/doc-templates';
import { addDays, formatINR, displayDate, istDate } from '@ss/domain';
import type { Ctx } from '../context.js';
import type { Doc, Tx } from '../db/types.js';
import { AppError, fail } from '../http/errors.js';
import { authn, clientIp, info, P, rateLimit, str } from '../http/pipeline.js';
import { audit, getCompany, getSettings, inScope, newId, nowIso, seal, sha256, token, unseal, type Settings } from '../shared/core.js';
import { respondToQuote, upiFor } from './sales.js';

const ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv', 'text/plain'];
const BLOCKED_EXT = /\.(exe|bat|cmd|com|msi|sh|ps1|js|jar|zip|rar|7z|tar|gz|apk|dmg|scr|vbs)$/i;
const CHUNK = 512 * 1024;

export const shareUrl = (ctx: Ctx, tok: string) => `${ctx.cfg.appOrigin}/s/${tok}`;

/** RULE-049: one active link per document; 256-bit token; looked up by SHA-256 hash; the token itself is kept only AES-GCM sealed (DATA_ENC_KEY) so the URL can be shown again. */
export async function createShareLinkInTx(ctx: Ctx, t: Tx, l: { documentType: string; documentId: string; expiresAt: string | null; userId: string; range?: { from: string; to: string } }) {
  const existing = (await t.query('shareLinks', { where: [['documentType', '==', l.documentType], ['documentId', '==', l.documentId], ['revokedAt', '==', null]], limit: 5 })).items;
  for (const e of existing) t.update('shareLinks', e.id, { revokedAt: nowIso(ctx), revokedReason: 'replaced' });
  const tok = token(32);
  const id = sha256(tok);
  t.create('shareLinks', id, { documentType: l.documentType, documentId: l.documentId, range: l.range ?? null, createdBy: l.userId, createdAt: nowIso(ctx), expiresAt: l.expiresAt, revokedAt: null, accessCount: 0, lastAccessAt: null, tokenSealed: seal(tok) });
  return { id, token: tok };
}

const recordCol: Record<string, string> = { quote: 'quotations', invoice: 'invoices', receipt: 'payments', statement: 'customers' };
const recordRes: Record<string, 'quote' | 'invoice' | 'payment' | 'customer'> = { quote: 'quote', invoice: 'invoice', receipt: 'payment', statement: 'customer' };

function defaultExpiry(ctx: Ctx, type: string, doc: Doc) {
  if (type === 'quote') return new Date(`${addDays(String(doc.validUntil), 7)}T18:29:59Z`).toISOString();
  if (type === 'statement') return new Date(ctx.clock.now().getTime() + 30 * 86_400_000).toISOString();
  return null; // invoices/receipts: 90 days after balance reaches zero (set by payments)
}

// ---------------- file storage (Drive when connected; Firestore blobs in dev/test) ----------------
export async function storeBlob(ctx: Ctx, path: string[], name: string, mimeType: string, data: Buffer, existing?: { storage: string; ref: string } | null) {
  const conn = await ctx.google.connected().catch(() => null);
  if (conn) {
    const ref = await ctx.google.uploadFile(path, name, mimeType, data, existing?.storage === 'drive' ? existing.ref : null);
    return { storage: 'drive', ref };
  }
  const ref = existing?.storage === 'blob' ? existing.ref : newId('blob_');
  await ctx.db.tx(async (t) => t.set('blobs', ref, { name, mimeType, size: data.length, b64: data.toString('base64') }));
  return { storage: 'blob', ref };
}
export async function readBlob(ctx: Ctx, f: { storage: string; ref: string }) {
  if (f.storage === 'drive') return (await ctx.google.downloadFile(f.ref)).data;
  const b = await ctx.db.get('blobs', f.ref);
  if (!b) fail('NOT_FOUND');
  return Buffer.from(String(b!.b64), 'base64');
}

/** Store an export (xlsx or html) as a 1-hour file (exports folder) and return a job result. */
export async function storeExport(ctx: Ctx, name: string, columns: string[] | null, rows: Record<string, unknown>[], html?: string) {
  let data: Buffer;
  let mime: string;
  if (columns) {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Data');
    ws.columns = columns.map((c) => ({ header: c, key: c, width: 18 }));
    for (const r of rows) ws.addRow(r);
    data = Buffer.from(await wb.xlsx.writeBuffer());
    mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  } else {
    const pdf = html ? await ctx.pdf.render(html) : null;
    data = pdf ?? Buffer.from(html ?? '');
    mime = pdf ? 'application/pdf' : 'text/html';
    if (pdf) name = name.replace(/\.html$/, '.pdf');
  }
  const stored = await storeBlob(ctx, ['Exports'], name, mime, data);
  const id = newId('f_');
  await ctx.db.tx(async (t) => t.create('files', id, { name, mimeType: mime, size: data.length, kind: 'export', recordType: 'export', recordId: null, ownerId: null, ...stored, status: 'ready', createdAt: nowIso(ctx), expireAt: new Date(ctx.clock.now().getTime() + 3_600_000).toISOString() }));
  return { fileId: id, name, url: `/api/v1/files/${id}/content` };
}

// ---------------- document rendering (FR-055, FR-067, FR-072) ----------------
export async function buildDocInput(ctx: Ctx, kind: 'quote' | 'invoice' | 'receipt' | 'credit_note', id: string): Promise<{ input: DocInput; recordRef: { customerId: string | null; leadId: string | null }; folder: string } | null> {
  const company = await getCompany(ctx);
  const settings: Settings = await getSettings(ctx);
  const companyView = { legalName: company.legalName, address: company.address, gstin: company.gstin, stateCode: company.stateCode, phone: company.phone, email: company.email, jurisdiction: company.jurisdiction, signatory: company.signatory, logoDataUrl: company.logoDataUrl ?? null };
  if (kind === 'quote') {
    const q = await ctx.db.get('quotations', id);
    if (!q) return null;
    const party = q.customerId ? await ctx.db.get('customers', String(q.customerId)) : await ctx.db.get('leads', String(q.leadId));
    return {
      input: {
        kind: 'quotation', number: (q.displayNumber as string) ?? null, date: String(q.date), validUntil: String(q.validUntil), placeOfSupply: String(q.placeOfSupply), company: companyView,
        billTo: { name: String(party?.displayName ?? party?.name ?? q.partyName), address: (party?.city as string) ?? null, gstin: (party?.gstin as string) ?? null },
        lines: q.lines as DocInput['lines'], totals: q.totals as DocInput['totals'], terms: (q.termsText as string) ?? null, notes: (q.notes as string) ?? null, poweredBy: settings.branding.poweredBy,
      },
      recordRef: { customerId: (q.customerId as string) ?? null, leadId: (q.leadId as string) ?? null }, folder: 'Quotations',
    };
  }
  if (kind === 'invoice') {
    const i = await ctx.db.get('invoices', id);
    if (!i) return null;
    const order = i.orderId ? await ctx.db.get('salesOrders', String(i.orderId)) : null;
    const snap = (i.company as typeof companyView | undefined) ?? companyView;
    const bank = i.bank as { bankName: string; accountNo: string; ifsc: string; branch?: string } | null;
    return {
      input: {
        kind: i.type as DocInput['kind'], copy: 'ORIGINAL', number: (i.number as string) ?? null, date: String(i.date), dueDate: String(i.dueDate), placeOfSupply: String(i.placeOfSupply),
        refs: [order && !order.hidden ? { label: 'Order', value: String(order.number) } : null, order?.customerPoRef ? { label: 'PO ref', value: String(order.customerPoRef) } : null].filter(Boolean) as { label: string; value: string }[],
        company: snap, billTo: i.billTo as DocInput['billTo'], shipTo: (i.shipTo as DocInput['shipTo']) ?? null, lines: i.lines as DocInput['lines'], totals: i.totals as DocInput['totals'], notes: (i.notes as string) ?? null,
        payment: i.status === 'draft' ? null : {
          balance: i.type === 'proforma' ? (await upiFor(ctx, i)).amount : Number(i.balanceDue ?? 0), paid: Number(i.paid ?? 0), vpa: (i.upi as { vpa?: string } | null)?.vpa ?? null, payeeName: (i.upi as { payee?: string } | null)?.payee ?? null,
          trEnabled: (i.upi as { trEnabled?: boolean } | null)?.trEnabled !== false, bank: bank ? { name: bank.bankName, accountNo: bank.accountNo, ifsc: bank.ifsc, branch: bank.branch } : null, showQr: true,
        },
        poweredBy: settings.branding.poweredBy,
      },
      recordRef: { customerId: String(i.customerId), leadId: null }, folder: 'Invoices',
    };
  }
  if (kind === 'credit_note') {
    const cn = await ctx.db.get('creditNotes', id);
    if (!cn) return null;
    const inv = await ctx.db.get('invoices', String(cn.invoiceId));
    const amount = Number(cn.amount);
    const tax = cn.taxSplit as { cgst: number; sgst: number; igst: number };
    const taxable = amount - tax.cgst - tax.sgst - tax.igst;
    return {
      input: {
        kind: 'credit_note', number: String(cn.number), date: String(cn.date), refs: [{ label: 'Against invoice', value: String(cn.invoiceNumber) }], company: (inv?.company as typeof companyView) ?? companyView,
        billTo: (inv?.billTo as DocInput['billTo']) ?? { name: '' }, lines: [{ description: `Credit: ${cn.reason}`, qty: 1, rate: taxable, discount: 0, taxable, taxRatePct: 0, cgst: tax.cgst, sgst: tax.sgst, igst: tax.igst, total: amount }],
        totals: { subTotal: taxable, discountTotal: 0, taxable, cgst: tax.cgst, sgst: tax.sgst, igst: tax.igst, roundOff: 0, grandTotal: amount, inWords: '' }, poweredBy: settings.branding.poweredBy,
      },
      recordRef: { customerId: String(cn.customerId), leadId: null }, folder: 'Invoices',
    };
  }
  const pmt = await ctx.db.get('payments', id);
  if (!pmt) return null;
  const c = await ctx.db.get('customers', String(pmt.customerId));
  const total = Number(pmt.amount) + Number(pmt.tdsAmount ?? 0);
  return {
    input: {
      kind: 'receipt', number: String(pmt.receiptNo), date: String(pmt.date), company: companyView, billTo: { name: String(c?.legalName ?? c?.displayName ?? '') }, lines: [],
      totals: { subTotal: total, discountTotal: 0, taxable: total, cgst: 0, sgst: 0, igst: 0, roundOff: 0, grandTotal: total, inWords: '' },
      receipt: { amount: Number(pmt.amount), mode: String(pmt.mode), reference: (pmt.reference as string) ?? null, tds: Number(pmt.tdsAmount ?? 0), allocations: (pmt.allocations as { number: string; amount: number }[]) ?? [], cancelledReason: pmt.status === 'reversed' ? String((pmt.reversal as { reason?: string })?.reason ?? 'reversed') : null },
      poweredBy: settings.branding.poweredBy,
    },
    recordRef: { customerId: String(pmt.customerId), leadId: null }, folder: 'Payments',
  };
}

/** Task `pdf.render` — 3 attempts then failed + alert (FR-055 AC2, E-09/E-10). */
export async function renderPdfTask(ctx: Ctx, kind: 'quote' | 'invoice' | 'receipt' | 'credit_note', id: string) {
  const col = { quote: 'quotations', invoice: 'invoices', receipt: 'payments', credit_note: 'creditNotes' }[kind];
  const built = await buildDocInput(ctx, kind, id);
  if (!built) return;
  const doc = (await ctx.db.get(col, id))!;
  const pdfState = (doc.pdf as { attempts?: number; fileId?: string; version?: number } | null) ?? {};
  try {
    const html = await renderDocumentHtml(built.input);
    const pdf = await ctx.pdf.render(html);
    const data = pdf ?? Buffer.from(html);
    const mime = pdf ? 'application/pdf' : 'text/html';
    const name = `${(built.input.number ?? id).replace(/\//g, '-')}.${pdf ? 'pdf' : 'html'}`;
    const existingFile = pdfState.fileId ? await ctx.db.get('files', pdfState.fileId) : null;
    const customer = built.recordRef.customerId ? await ctx.db.get('customers', built.recordRef.customerId) : null;
    const path = customer ? ['Customers', `${customer.code} – ${customer.displayName}`, built.folder] : ['Leads', String(built.recordRef.leadId)];
    const stored = await storeBlob(ctx, path, name, mime, data, existingFile ? { storage: String(existingFile.storage), ref: String(existingFile.ref) } : null);
    const fileId = existingFile?.id ?? newId('f_');
    await ctx.db.tx(async (t) => {
      const base = { name, mimeType: mime, size: data.length, kind: 'generated', docType: kind, recordType: kind, recordId: id, customerId: built.recordRef.customerId, ownerId: doc.ownerId ?? null, ...stored, status: 'ready', updatedAt: nowIso(ctx) };
      if (existingFile) t.update('files', fileId, { ...base, docVersion: Number(existingFile.docVersion ?? 1) + 1 });
      else t.create('files', fileId, { ...base, docVersion: 1, createdAt: nowIso(ctx) });
      t.update(col, id, { pdf: { status: 'ready', fileId, attempts: 0, version: Number(pdfState.version ?? 0) + 1, renderedAt: nowIso(ctx) } });
    });
  } catch (e) {
    const attempts = Number(pdfState.attempts ?? 0) + 1;
    await ctx.db.tx(async (t) => t.update(col, id, { pdf: { ...pdfState, status: attempts >= 3 ? 'failed' : 'pending', attempts, error: (e as Error).message } }));
    if (attempts < 3) await ctx.tasks.enqueue('pdf.render', { kind, id });
    else ctx.log.error({ kind, id, err: (e as Error).message }, 'pdf.failed');
  }
}

export async function renderStatementHtml(ctx: Ctx, c: Doc, st: { from: string; to: string; opening: number; rows: { date: string; kind: string; docNumber: string; debit: number; credit: number; balance: number }[]; closing: number }) {
  const company = await getCompany(ctx);
  const m = (p: number) => formatINR(p, false);
  return `<!doctype html><html><head><meta charset="utf-8"><title>Statement ${c.code}</title><style>body{font-family:Inter,Arial,sans-serif;font-size:11px;color:#0f172a}table{width:100%;border-collapse:collapse}th,td{padding:5px;border-bottom:1px solid #e2e8f0;text-align:left}.r{text-align:right}h1{font-size:16px;color:#1d4ed8}</style></head><body>
<h1>Statement of account</h1><div><b>${company.legalName}</b></div><div>${String(c.legalName ?? c.displayName)} (${c.code}) · ${displayDate(st.from)} to ${displayDate(st.to)}</div>
<table><thead><tr><th>Date</th><th>Particulars</th><th>Document</th><th class="r">Debit</th><th class="r">Credit</th><th class="r">Balance</th></tr></thead><tbody>
<tr><td>${displayDate(st.from)}</td><td>Opening balance</td><td></td><td></td><td></td><td class="r">${m(st.opening)}</td></tr>
${st.rows.map((r) => `<tr><td>${displayDate(r.date)}</td><td>${r.kind.replace('_', ' ')}</td><td>${r.docNumber}</td><td class="r">${r.debit ? m(r.debit) : ''}</td><td class="r">${r.credit ? m(r.credit) : ''}</td><td class="r">${m(r.balance)}</td></tr>`).join('')}
<tr><td></td><td><b>Closing balance</b></td><td></td><td></td><td></td><td class="r"><b>${m(st.closing)}</b></td></tr></tbody></table></body></html>`;
}

export function documentsRoutes(ctx: Ctx): Router {
  const r = Router();
  const publicLimit = rateLimit('public', 30);

  // ---------------- public share pages (API-205, API-206, API-151) ----------------
  async function resolve(tok: string) {
    const link = await ctx.db.get('shareLinks', sha256(tok));
    if (!link) throw new AppError('NOT_FOUND');
    const company = await getCompany(ctx);
    if (link.revokedAt) throw new AppError('LINK_INACTIVE', `This link is no longer active — contact ${company.tradeName ?? company.legalName}.`);
    if (link.expiresAt && new Date(String(link.expiresAt)) < ctx.clock.now()) throw new AppError('LINK_EXPIRED', `This link has expired — contact ${company.tradeName ?? company.legalName}.`);
    const doc = await ctx.db.get(recordCol[String(link.documentType)]!, String(link.documentId));
    if (!doc) throw new AppError('LINK_INACTIVE');
    return { link, doc, company };
  }

  r.get('/public/s/:token', publicLimit, async (req, res) => {
    const { link, doc, company } = await resolve(String(req.params.token));
    const settings = await getSettings(ctx);
    const internal = !!req.header('authorization') || !!req.cookies?.rt || !!req.cookies?.['__Secure-rt'];
    const ua = req.header('user-agent') ?? '';
    await ctx.db.tx(async (t) => {
      t.create('shareAccess', newId('sa_'), { linkId: link.id, at: nowIso(ctx), ipMasked: clientIp(req).replace(/\.\d+$/, '.x'), deviceType: /mobile/i.test(ua) ? 'mobile' : 'desktop', internal, expireAt: new Date(ctx.clock.now().getTime() + 400 * 86_400_000).toISOString() });
      t.update('shareLinks', link.id, { accessCount: Number(link.accessCount ?? 0) + 1, lastAccessAt: nowIso(ctx) });
      // FR-058: count customer views (not internal), first view → Viewed + N-007
      if (link.documentType === 'quote' && !internal) {
        const q = await t.get('quotations', doc.id);
        if (q) {
          const first = !q.firstViewedAt;
          t.update('quotations', q.id, { viewCount: Number(q.viewCount ?? 0) + 1, lastViewedAt: nowIso(ctx), ...(first ? { firstViewedAt: nowIso(ctx) } : {}), ...(q.status === 'sent' ? { status: 'viewed' } : {}) });
          if (first) {
            const { notify } = await import('../shared/core.js');
            notify(ctx, t, [String(q.ownerId)], 'N-007', `${q.partyName} opened ${q.displayNumber}`, `/sales/quotes/${q.id}`, [`quote:${q.id}`]);
          }
        }
      }
    });
    const base = { companyName: company.tradeName ?? company.legalName, companyPhone: company.phone ?? null, companyEmail: company.email ?? null, poweredBy: settings.branding.poweredBy, primary: settings.branding.primary };
    if (link.documentType === 'quote') {
      const q = (await ctx.db.get('quotations', doc.id))!;
      const today = istDate(ctx.clock.now());
      let state = 'open';
      let latestUrl: string | null = null;
      if (q.status === 'superseded' || !q.isLatest) {
        state = 'superseded';
        const latest = (await ctx.db.all('quotations', { where: [['baseId', '==', q.baseId], ['isLatest', '==', true]] }))[0];
        const ll = latest?.shareLinkId ? await ctx.db.get('shareLinks', String(latest.shareLinkId)) : null;
        latestUrl = ll && !ll.revokedAt ? shareUrl(ctx, unseal(String(ll.tokenSealed))) : null;
      } else if (q.status === 'expired' || today > String(q.validUntil)) state = 'expired';
      else if (['accepted', 'rejected', 'changes_requested'].includes(String(q.status))) state = String(q.status);
      const html = await renderDocumentHtml((await buildDocInput(ctx, 'quote', q.id))!.input);
      return void res.json({ ...base, type: 'quote', state, latestUrl, number: q.displayNumber, date: q.date, validUntil: q.validUntil, partyName: q.partyName, totals: q.totals, lines: q.lines, response: q.response, html, actions: state === 'open' ? ['accept', 'changes', 'reject'] : [] });
    }
    if (link.documentType === 'invoice') {
      const i = doc;
      const upi = await upiFor(ctx, i);
      const html = await renderDocumentHtml((await buildDocInput(ctx, 'invoice', i.id))!.input);
      return void res.json({ ...base, type: 'invoice', number: i.number, invoiceType: i.type, date: i.date, dueDate: i.dueDate, totals: i.totals, balanceDue: i.balanceDue, paid: upi.paid || Number(i.balanceDue) === 0, upi: { uri: upi.uri, amount: upi.amount, qrSvg: upi.qrSvg, vpa: (i.upi as { vpa?: string } | null)?.vpa ?? null }, bank: i.bank ?? null, html });
    }
    if (link.documentType === 'receipt') {
      const html = await renderDocumentHtml((await buildDocInput(ctx, 'receipt', doc.id))!.input);
      return void res.json({ ...base, type: 'receipt', number: doc.receiptNo, amount: doc.amount, status: doc.status, html });
    }
    const { statementFor } = await import('./customers.js');
    const range = (link.range as { from: string; to: string }) ?? { from: `${istDate(ctx.clock.now()).slice(0, 4)}-04-01`, to: istDate(ctx.clock.now()) };
    const st = await statementFor(ctx, doc.id, range.from, range.to);
    res.json({ ...base, type: 'statement', customer: doc.displayName, ...st, html: await renderStatementHtml(ctx, doc, st) });
  });

  r.post('/public/s/:token/respond', publicLimit, async (req, res) => {
    const { link, doc } = await resolve(String(req.params.token));
    if (link.documentType !== 'quote') fail('NOT_FOUND');
    const body = RespondBody.parse(req.body);
    res.json(await respondToQuote(ctx, doc.id, body, clientIp(req), req));
  });

  r.get('/public/s/:token/pdf', publicLimit, async (req, res) => {
    const { link, doc } = await resolve(String(req.params.token));
    const kind = link.documentType === 'receipt' ? 'receipt' : (String(link.documentType) as 'quote' | 'invoice');
    if (link.documentType === 'statement') fail('NOT_FOUND');
    // always render fresh so the payment block carries the live balance (FR-069 AC1)
    const html = await renderDocumentHtml((await buildDocInput(ctx, kind, doc.id))!.input);
    const pdf = await ctx.pdf.render(html);
    res.setHeader('Content-Disposition', `inline; filename="${String(doc.number ?? doc.displayNumber ?? doc.receiptNo ?? 'document').replace(/\//g, '-')}.${pdf ? 'pdf' : 'html'}"`);
    res.type(pdf ? 'application/pdf' : 'text/html').send(pdf ?? html);
  });

  // ---------------- authenticated ----------------
  r.use(['/share-links', '/files', '/documents'], authn);

  r.post('/share-links', async (req, res) => {
    const p = P(req);
    const body = ShareLinkBody.parse(req.body);
    const doc = await ctx.db.get(recordCol[body.documentType]!, body.documentId);
    if (!doc || !inScope(p, recordRes[body.documentType]!, 'read', String(doc.ownerId))) fail('NOT_FOUND');
    if (body.documentType === 'invoice' && doc!.status === 'draft') fail('VALIDATION_FAILED', 'Issue the invoice first');
    if (body.documentType === 'quote' && !doc!.number) fail('VALIDATION_FAILED', 'Send the quotation first');
    const out = await ctx.db.tx(async (t) => {
      const l = await createShareLinkInTx(ctx, t, { documentType: body.documentType, documentId: body.documentId, expiresAt: defaultExpiry(ctx, body.documentType, doc!), userId: p.userId, range: body.from && body.to ? { from: body.from, to: body.to } : undefined });
      if (body.documentType === 'quote') t.update('quotations', doc!.id, { shareLinkId: l.id });
      audit(ctx, t, info(req), { action: 'share_link.create', recordType: body.documentType, recordId: body.documentId });
      return l;
    });
    const link = (await ctx.db.get('shareLinks', out.id))!;
    res.status(201).json({ id: out.id, url: shareUrl(ctx, out.token), expiresAt: link.expiresAt });
  });

  r.get('/share-links', async (req, res) => {
    const p = P(req);
    const type = str(req.query.documentType) ?? '';
    const docId = str(req.query.documentId) ?? '';
    const doc = recordCol[type] ? await ctx.db.get(recordCol[type]!, docId) : null;
    if (!doc || !inScope(p, recordRes[type]!, 'read', String(doc.ownerId))) fail('NOT_FOUND');
    const links = await ctx.db.all('shareLinks', { where: [['documentType', '==', type], ['documentId', '==', docId]] });
    res.json({ items: links.map((l) => ({ id: l.id, url: l.revokedAt ? null : shareUrl(ctx, unseal(String(l.tokenSealed))), createdAt: l.createdAt, expiresAt: l.expiresAt, revokedAt: l.revokedAt, accessCount: l.accessCount, lastAccessAt: l.lastAccessAt })) });
  });

  r.patch('/share-links/:id', async (req, res) => {
    const p = P(req);
    const body = ShareLinkPatchBody.parse(req.body);
    const id = String(req.params.id);
    await ctx.db.tx(async (t) => {
      const l = await t.get('shareLinks', id);
      if (!l) fail('NOT_FOUND');
      const doc = await t.get(recordCol[String(l!.documentType)]!, String(l!.documentId));
      if (!doc || !inScope(p, recordRes[String(l!.documentType)]!, 'read', String(doc.ownerId))) fail('NOT_FOUND');
      t.update('shareLinks', id, body.action === 'revoke' ? { revokedAt: nowIso(ctx) } : { expiresAt: body.expiresAt ?? new Date(ctx.clock.now().getTime() + 30 * 86_400_000).toISOString(), revokedAt: null });
      audit(ctx, t, info(req), { action: `share_link.${body.action}`, recordType: String(l!.documentType), recordId: String(l!.documentId) });
    });
    res.json({ ok: true });
  });

  // Files (FR-078, RULE-050)
  const recordFor = async (recordType: string, recordId: string) => {
    const map: Record<string, [string, 'lead' | 'customer' | 'quote' | 'order' | 'invoice' | 'payment']> = { lead: ['leads', 'lead'], customer: ['customers', 'customer'], quote: ['quotations', 'quote'], order: ['salesOrders', 'order'], invoice: ['invoices', 'invoice'], payment: ['payments', 'payment'] };
    const m = map[recordType];
    if (!m) fail('VALIDATION_FAILED', 'Unknown record type');
    return { doc: await ctx.db.get(m![0], recordId), res: m![1] };
  };

  r.post('/files/uploads', async (req, res) => {
    const p = P(req);
    const { recordType, recordId, name, mimeType, size } = req.body as { recordType: string; recordId: string; name: string; mimeType: string; size: number };
    if (Number(size) > ctx.cfg.fileMaxMb * 1024 * 1024) fail('FILE_TOO_LARGE');
    if (BLOCKED_EXT.test(String(name)) || !ALLOWED_MIME.includes(String(mimeType))) fail('FILE_TYPE_BLOCKED');
    const { doc, res: resource } = await recordFor(recordType, recordId);
    if (!doc || !inScope(p, resource, 'read', String(doc.ownerId))) fail('NOT_FOUND');
    const id = newId('up_');
    await ctx.db.tx(async (t) => t.create('uploadSessions', id, { recordType, recordId, name, mimeType, size: Number(size), received: 0, chunks: 0, uploadedBy: p.userId, customerId: recordType === 'customer' ? recordId : (doc!.customerId ?? null), ownerId: doc!.ownerId ?? null, expireAt: new Date(ctx.clock.now().getTime() + 86_400_000).toISOString() }));
    res.status(201).json({ sessionId: id, chunkSize: CHUNK, received: 0 });
  });

  r.put('/files/uploads/:id', express.raw({ type: '*/*', limit: CHUNK + 1024 }), async (req, res) => {
    const p = P(req);
    const id = String(req.params.id);
    const s = await ctx.db.get('uploadSessions', id);
    if (!s || s.uploadedBy !== p.userId) fail('NOT_FOUND');
    const range = /bytes (\d+)-(\d+)\/(\d+)/.exec(req.header('content-range') ?? '');
    const body = req.body as Buffer;
    if (!range || Number(range[1]) !== Number(s!.received)) return void res.status(308).setHeader('Range', `bytes=0-${Number(s!.received) - 1}`).json({ received: s!.received });
    if (Number(s!.received) === 0 && body.subarray(0, 2).toString('latin1') === 'MZ') fail('FILE_TYPE_BLOCKED'); // Windows executable magic bytes
    await ctx.db.tx(async (t) => {
      t.set('uploadChunks', `${id}_${s!.chunks}`, { b64: body.toString('base64'), expireAt: s!.expireAt });
      t.update('uploadSessions', id, { received: Number(s!.received) + body.length, chunks: Number(s!.chunks) + 1 });
    });
    const received = Number(s!.received) + body.length;
    if (received < Number(s!.size)) return void res.status(308).json({ received });
    const parts: Buffer[] = [];
    for (let n = 0; n <= Number(s!.chunks); n++) {
      const c = await ctx.db.get('uploadChunks', `${id}_${n}`);
      if (c) parts.push(Buffer.from(String(c.b64), 'base64'));
    }
    const data = Buffer.concat(parts);
    const customer = s!.customerId ? await ctx.db.get('customers', String(s!.customerId)) : null;
    const stored = await storeBlob(ctx, customer ? ['Customers', `${customer.code} – ${customer.displayName}`, 'Documents'] : ['Leads', String(s!.recordId)], String(s!.name), String(s!.mimeType), data);
    const fileId = newId('f_');
    await ctx.db.tx(async (t) => {
      t.create('files', fileId, { name: s!.name, mimeType: s!.mimeType, size: data.length, kind: 'upload', recordType: s!.recordType, recordId: s!.recordId, customerId: s!.customerId, ownerId: s!.ownerId, ...stored, status: 'ready', uploadedBy: p.userId, createdAt: nowIso(ctx) });
      for (let n = 0; n <= Number(s!.chunks); n++) t.delete('uploadChunks', `${id}_${n}`);
      t.delete('uploadSessions', id);
      audit(ctx, t, info(req), { action: 'file.upload', recordType: String(s!.recordType), recordId: String(s!.recordId), meta: { name: s!.name, size: data.length } });
    });
    res.status(201).json(await ctx.db.get('files', fileId));
  });

  r.get('/files', async (req, res) => {
    const p = P(req);
    const { doc, res: resource } = await recordFor(String(req.query.recordType), String(req.query.recordId));
    if (!doc || !inScope(p, resource, 'read', String(doc.ownerId))) fail('NOT_FOUND');
    const where: [string, '==', unknown][] = req.query.recordType === 'customer' ? [['customerId', '==', doc!.id]] : [['recordId', '==', doc!.id]];
    res.json({ items: (await ctx.db.all('files', { where, orderBy: [['createdAt', 'desc']] })).map(({ ref: _r, ...f }) => f) });
  });

  r.get('/files/:id/content', async (req, res) => {
    const p = P(req);
    const f = await ctx.db.get('files', String(req.params.id));
    if (!f) fail('NOT_FOUND');
    if (f!.kind === 'export') {
      if (f!.expireAt && new Date(String(f!.expireAt)) < ctx.clock.now()) fail('LINK_EXPIRED');
    } else if (!(p.role === 'admin' || inScope(p, 'file', 'read', String(f!.ownerId)))) fail('NOT_FOUND');
    const data = await readBlob(ctx, { storage: String(f!.storage), ref: String(f!.ref) });
    res.setHeader('Content-Disposition', `${req.query.download ? 'attachment' : 'inline'}; filename="${encodeURIComponent(String(f!.name))}"`);
    res.type(String(f!.mimeType)).send(data);
  });

  r.delete('/files/:id', async (req, res) => {
    const p = P(req);
    const f = await ctx.db.get('files', String(req.params.id));
    if (!f) fail('NOT_FOUND');
    if (f!.kind === 'generated') fail('FORBIDDEN', 'Generated documents cannot be deleted');
    const mine = f!.uploadedBy === p.userId && ctx.clock.now().getTime() - new Date(String(f!.createdAt)).getTime() < 86_400_000;
    if (p.role !== 'admin' && !mine) fail('FORBIDDEN');
    if (f!.storage === 'drive') await ctx.google.deleteFile(String(f!.ref)).catch(() => undefined);
    await ctx.db.tx(async (t) => {
      t.delete('files', f!.id);
      if (f!.storage === 'blob') t.delete('blobs', String(f!.ref));
      audit(ctx, t, info(req), { action: 'file.delete', recordType: String(f!.recordType), recordId: String(f!.recordId), meta: { name: f!.name } });
    });
    res.status(204).end();
  });

  // API-210 HTML preview (same template as the PDF)
  r.get('/documents/:type/:id/preview', async (req, res) => {
    const p = P(req);
    const type = String(req.params.type) as 'quote' | 'invoice' | 'receipt' | 'credit_note';
    const col = { quote: 'quotations', invoice: 'invoices', receipt: 'payments', credit_note: 'creditNotes' }[type];
    if (!col) fail('NOT_FOUND');
    const doc = await ctx.db.get(col!, String(req.params.id));
    const res2 = { quote: 'quote', invoice: 'invoice', receipt: 'payment', credit_note: 'invoice' }[type] as 'quote';
    if (!doc || !inScope(p, res2, 'read', String(doc.ownerId))) fail('NOT_FOUND');
    const built = await buildDocInput(ctx, type, doc!.id);
    res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; img-src data:");
    res.type('text/html').send(await renderDocumentHtml(built!.input));
  });

  return r;
}

/** drive.moveLeadFiles task (FR-077 AC2): after conversion, the lead's Drive files move to the customer's Documents folder.
 * Idempotent (movedAt) and retried by Cloud Tasks if the conversion has not committed yet. */
export async function moveLeadFilesTask(ctx: Ctx, leadId: string, customerId: string) {
  const customer = await ctx.db.get('customers', customerId);
  if (!customer) throw new Error(`customer ${customerId} not committed yet`);
  const files = await ctx.db.all('files', { where: [['recordId', '==', leadId]] });
  for (const f of files.filter((x) => x.storage === 'drive' && !x.movedAt)) {
    await ctx.google.moveFile(String(f.ref), ['Customers', `${customer.code} – ${customer.displayName}`, 'Documents']);
    await ctx.db.tx(async (t) => t.update('files', f.id, { movedAt: nowIso(ctx) }));
  }
}
