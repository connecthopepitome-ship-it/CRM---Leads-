import { Router, type Request } from 'express';
import { ApprovalBody, CreditNoteBody, InvoiceBody, InvoicePatchBody, OrderBody, OrderStatusBody, QuoteBody, RespondBody, SendBody } from '@ss/contracts';
import {
  addDays, balanceDue, buildUpiUri, canAccept, canOrderTransition, computeDocument, creditNoteEffect, dueDate, invoiceStatus, isIntraState, istDate, needsApproval,
  pendingQty, placeOfSupply, renderTemplate, roundHalfUp, SAC_PATTERN, HSN_PATTERN, searchTokens, waLink, type LineInput,
} from '@ss/domain';
import { upiQrSvg } from '@ss/doc-templates';
import type { Ctx, Principal } from '../context.js';
import type { Doc, Tx, Where } from '../db/types.js';
import { AppError, fail } from '../http/errors.js';
import { authn, info, P, paging, requirePerm, str } from '../http/pipeline.js';
import { audit, checkVersion, created, getCompany, getSettings, nextDocNumber, notify, nowIso, newId, requireCan, requireModule, requireScope, scopeWhere, stamp, type DocType, type ReqInfo } from '../shared/core.js';
import { actor, addActivity } from '../shared/records.js';
import { applyCustomerDelta, postLedger } from './customers.js';
import { createShareLinkInTx, shareUrl } from './documents.js';
import { applyStage, convertLead } from './leads.js';
import { markInUse, masterItems } from './masters.js';

type LineBody = ReturnType<typeof QuoteBody.parse>['lines'][number];
const STAGE_ORDER = ['new', 'contacted', 'interested', 'quotation_sent', 'negotiation'];

async function partyInfo(ctx: Ctx, t: Tx | null, partyType: string, partyId: string) {
  const r = t ?? ctx.db;
  if (partyType === 'lead') {
    const l = await r.get('leads', partyId);
    if (!l) fail('NOT_FOUND');
    return { lead: l!, customer: l!.customerId ? await r.get('customers', String(l!.customerId)) : null, stateCode: (l!.state as string) || null, ownerId: String(l!.ownerId) };
  }
  const c = await r.get('customers', partyId);
  if (!c) fail('NOT_FOUND');
  return { lead: null, customer: c!, stateCode: (c!.billingStateCode as string) || null, ownerId: String(c!.ownerId) };
}

export async function computeLines(ctx: Ctx, t: Tx | null, lines: LineBody[] | LineInput[], pos: string, overallDiscountPct = 0, opts: { gstOverride?: boolean } = {}) {
  const company = await getCompany(ctx, t ?? undefined);
  const settings = await getSettings(ctx, t ?? undefined);
  const gst = opts.gstOverride ?? company.gstRegistered;
  const intraState = isIntraState(company.stateCode, pos);
  const doc = computeDocument(lines as LineInput[], { gst, intraState, overallDiscountPct, roundOff: settings.sales.roundOff });
  const outLines = (lines as LineBody[]).map((l, i) => ({ ...l, ...doc.lines[i] }));
  return { lines: outLines, totals: doc.totals, intraState, gst };
}

export function quoteTokens(q: Record<string, unknown>) {
  return searchTokens({ docNumbers: [q.number as string], names: [q.partyName as string] });
}

export function salesRoutes(ctx: Ctx): Router {
  const r = Router();
  r.use(['/quotes', '/orders', '/invoices', '/credit-notes', '/sales'], authn);
  r.use('/orders', requireModule(ctx, 'orders'));

  // ======================= Quotations =======================
  r.get('/quotes', async (req, res) => {
    const p = P(req);
    const scope = scopeWhere(p, 'quote');
    if (!scope) fail('FORBIDDEN');
    const where: Where[] = [...scope!];
    if (str(req.query.status)) where.push(['status', 'in', String(req.query.status).split(',')]);
    if (str(req.query.partyId)) where.push(['partyId', '==', str(req.query.partyId)]);
    if (str(req.query.customerId)) where.push(['customerId', '==', str(req.query.customerId)]);
    if (req.query.latest !== '0') where.push(['isLatest', '==', true]);
    const page = await ctx.db.query('quotations', { where, orderBy: [['updatedAt', 'desc']], ...paging(req) });
    res.json(page);
  });

  r.post('/sales/calc', async (req, res) => {
    const body = QuoteBody.partial({ partyType: true, partyId: true }).parse(req.body);
    const company = await getCompany(ctx);
    const out = await computeLines(ctx, null, body.lines!, body.placeOfSupply ?? company.stateCode, body.overallDiscountPct ?? 0);
    res.json(out.totals);
  });

  r.post('/quotes', async (req, res) => {
    const p = P(req);
    requireCan(p, 'quote', 'create');
    const body = QuoteBody.parse(req.body);
    const id = newId('q_');
    await ctx.db.tx(async (t) => {
      const party = await partyInfo(ctx, t, body.partyType, body.partyId);
      if (party.lead) requireScope(p, 'lead', 'read', party.lead);
      if (!party.lead && party.customer) requireScope(p, 'customer', 'read', party.customer);
      const company = await getCompany(ctx, t);
      const settings = await getSettings(ctx, t);
      const settingsSupply = settings.sales.supplyKind;
      const pos = body.placeOfSupply ?? placeOfSupply({ kind: settingsSupply, companyState: company.stateCode, billingState: party.stateCode });
      const calc = await computeLines(ctx, t, body.lines, pos, body.overallDiscountPct ?? 0);
      const date = body.date ?? istDate(ctx.clock.now());
      const terms = body.termsText ?? ((await masterItems(ctx, 'termsTemplates')).find((x) => (x.data as { docType?: string }).docType === 'quote')?.data as { text?: string } | undefined)?.text ?? null;
      const q = {
        baseId: id, revision: 0, number: null, displayNumber: null, isLatest: true,
        partyType: body.partyType, partyId: body.partyId, partyName: party.customer?.displayName ?? party.lead?.name, leadId: party.lead?.id ?? null, customerId: party.customer?.id ?? null,
        ownerId: p.userId, // the creator owns the quotation (RULE-027 approval and self-approval are per owner)
        date, validUntil: addDays(date, body.validDays ?? settings.sales.validDays), validDays: body.validDays ?? settings.sales.validDays, placeOfSupply: pos, intraState: calc.intraState,
        status: 'draft', lines: calc.lines, totals: calc.totals, overallDiscountPct: body.overallDiscountPct ?? 0, maxDiscountPct: calc.totals.maxDiscountPct,
        approval: null, response: null, viewCount: 0, firstViewedAt: null, lastViewedAt: null, orderId: null, shareLinkId: null, pdf: { status: 'none' },
        termsText: terms, paymentTermId: body.paymentTermId ?? null, notes: body.notes ?? null, ...created(ctx, p),
      };
      t.create('quotations', id, { ...q, searchTokens: quoteTokens(q) });
      audit(ctx, t, info(req), { action: 'quote.create', recordType: 'quote', recordId: id, after: { partyId: body.partyId, grandTotal: calc.totals.grandTotal, lines: calc.lines } });
    });
    res.status(201).json(await ctx.db.get('quotations', id));
  });

  r.get('/quotes/:id', async (req, res) => {
    const q = await ctx.db.get('quotations', String(req.params.id));
    requireScope(P(req), 'quote', 'read', q);
    const revisions = await ctx.db.all('quotations', { where: [['baseId', '==', q.baseId]], orderBy: [['revision', 'asc']] });
    res.setHeader('ETag', String(q.version));
    res.json({ ...q, revisions: revisions.map((x) => ({ id: x.id, revision: x.revision, status: x.status, displayNumber: x.displayNumber, grandTotal: (x.totals as { grandTotal: number }).grandTotal })) });
  });

  r.patch('/quotes/:id', async (req, res) => {
    const p = P(req);
    const body = QuoteBody.partial().parse(req.body);
    const id = String(req.params.id);
    await ctx.db.tx(async (t) => {
      const q = await t.get('quotations', id);
      requireScope(p, 'quote', 'update', q);
      if (!['draft', 'pending_approval', 'approved'].includes(String(q.status))) fail('QUOTE_LOCKED');
      checkVersion(q, req.header('if-match'));
      const pos = body.placeOfSupply ?? String(q.placeOfSupply);
      const lines = body.lines ?? (q.lines as LineBody[]);
      const calc = await computeLines(ctx, t, lines, pos, body.overallDiscountPct ?? Number(q.overallDiscountPct ?? 0));
      const settings = await getSettings(ctx, t);
      const date = body.date ?? String(q.date);
      const validDays = body.validDays ?? Number(q.validDays ?? settings.sales.validDays);
      // RULE-027 / FR-053 AC4: approval stays only if the discount did not increase
      const approvedMax = (q.approval as { approvedMaxPct?: number } | null)?.approvedMaxPct;
      let status = String(q.status);
      if (status === 'approved' && approvedMax != null && calc.totals.maxDiscountPct > approvedMax + 1e-9) status = 'draft';
      if (status === 'pending_approval') status = 'draft';
      t.update('quotations', id, {
        lines: calc.lines, totals: calc.totals, placeOfSupply: pos, intraState: calc.intraState, maxDiscountPct: calc.totals.maxDiscountPct, date, validDays, validUntil: addDays(date, validDays),
        overallDiscountPct: body.overallDiscountPct ?? q.overallDiscountPct, termsText: body.termsText ?? q.termsText, notes: body.notes ?? q.notes, paymentTermId: body.paymentTermId ?? q.paymentTermId,
        status, ...stamp(ctx, p, Number(q.version)),
      });
      audit(ctx, t, info(req), { action: 'quote.update', recordType: 'quote', recordId: id, before: { totals: q.totals, lines: q.lines }, after: { totals: calc.totals, lines: calc.lines } });
    });
    res.json(await ctx.db.get('quotations', id));
  });

  r.delete('/quotes/:id', async (req, res) => {
    const p = P(req);
    const id = String(req.params.id);
    await ctx.db.tx(async (t) => {
      const q = await t.get('quotations', id);
      requireScope(p, 'quote', 'update', q);
      if (q.status !== 'draft' || q.number) fail('DOCUMENT_ISSUED');
      if (q.createdBy !== p.userId && p.role !== 'admin') fail('FORBIDDEN');
      t.delete('quotations', id);
      if (Number(q.revision) > 0) {
        const prev = (await t.query('quotations', { where: [['baseId', '==', q.baseId], ['revision', '==', Number(q.revision) - 1]], limit: 1 })).items[0];
        if (prev) t.update('quotations', prev.id, { isLatest: true });
      }
      audit(ctx, t, info(req), { action: 'quote.delete', recordType: 'quote', recordId: id });
    });
    res.status(204).end();
  });

  // API-145 Send (FR-053, FR-056)
  r.post('/quotes/:id/send', async (req, res) => {
    const p = P(req);
    const body = SendBody.parse(req.body ?? {});
    const id = String(req.params.id);
    const out = await ctx.db.tx(async (t) => {
      const q = await t.get('quotations', id);
      requireScope(p, 'quote', 'update', q);
      if (['sent', 'viewed'].includes(String(q.status))) {
        const link = q.shareLinkId ? await t.get('shareLinks', String(q.shareLinkId)) : null;
        return { status: q.status, number: q.displayNumber, shareUrl: link ? null : null, already: true };
      }
      if (!['draft', 'approved'].includes(String(q.status))) fail('QUOTE_LOCKED');
      const settings = await getSettings(ctx, t);
      const owner = await t.get('users', String(q.ownerId));
      const limit = settings.sales.discountLimits[String(owner?.role)] ?? (owner?.role === 'admin' ? 100 : 0);
      const approvedMax = (q.approval as { approvedMaxPct?: number } | null)?.approvedMaxPct ?? null;
      if (needsApproval({ mode: settings.mode.mode, maxDiscountPct: Number(q.maxDiscountPct ?? 0), roleLimitPct: limit, approvedMaxPct: q.status === 'approved' ? approvedMax : null })) {
        t.update('quotations', id, { status: 'pending_approval', approval: { requestedAt: nowIso(ctx), requestedBy: p.userId, decision: null }, ...stamp(ctx, p, Number(q.version)) });
        const managers = (await t.query('teams', { where: [['memberIds', 'array-contains', String(q.ownerId)]], limit: 10 })).items.map((x) => String(x.managerId));
        const admins = (await t.query('users', { where: [['role', '==', 'admin'], ['status', '==', 'active']], limit: 20 })).items.map((u) => u.id);
        notify(ctx, t, (managers.length ? managers : admins).filter((u) => u !== q.ownerId), 'N-005', `${owner?.fullName ?? 'A user'} requests ${Math.round(Number(q.maxDiscountPct))}% on a quotation for ${q.partyName}`, `/sales/quotes/${id}`, [`quote:${id}`]);
        audit(ctx, t, info(req), { action: 'quote.request_approval', recordType: 'quote', recordId: id, meta: { maxDiscountPct: q.maxDiscountPct, limit } });
        return { status: 'pending_approval' };
      }
      // allocate number (RULE-003; revisions keep the base number, RULE-028)
      let number = q.number as string | null;
      if (!number) number = await nextDocNumber(t, 'quote', String(q.date));
      const disp = Number(q.revision) > 0 ? `${number}-R${q.revision}` : number;
      // supersede earlier revisions
      if (Number(q.revision) > 0) {
        const prev = (await t.query('quotations', { where: [['baseId', '==', q.baseId]], limit: 50 })).items.filter((x) => x.id !== id && ['sent', 'viewed', 'changes_requested', 'rejected', 'expired'].includes(String(x.status)));
        for (const x of prev) t.update('quotations', x.id, { status: 'superseded', isLatest: false, supersededById: id });
      }
      const link = await createShareLinkInTx(ctx, t, { documentType: 'quote', documentId: id, expiresAt: new Date(new Date(`${addDays(String(q.validUntil), 7)}T18:29:59Z`).getTime()).toISOString(), userId: p.userId });
      const next = { ...q, number, displayNumber: disp };
      t.update('quotations', id, { status: 'sent', number, displayNumber: disp, sentAt: nowIso(ctx), shareLinkId: link.id, pdf: { status: 'pending', attempts: 0 }, searchTokens: quoteTokens(next), ...stamp(ctx, p, Number(q.version)) });
      // lead stage → quotation_sent (FR-056 AC2)
      if (q.leadId) {
        const l = await t.get('leads', String(q.leadId));
        if (l && STAGE_ORDER.indexOf(String(l.stage)) > -1 && STAGE_ORDER.indexOf(String(l.stage)) < STAGE_ORDER.indexOf('quotation_sent')) await applyStage(ctx, t, l, 'quotation_sent', null, p, { auto: true });
      }
      markInUse(t, (q.lines as { productId?: string }[]).map((l) => l.productId));
      const recordType = q.leadId && !q.customerId ? 'lead' : 'customer';
      addActivity(ctx, t, { recordType, recordId: String(recordType === 'lead' ? q.leadId : q.customerId), ownerId: String(q.ownerId), customerId: (q.customerId as string) ?? null, type: 'quote', note: `Quotation ${disp} sent (${body.channel})`, meta: { quoteId: id, channel: body.channel }, ...actor(p) });
      audit(ctx, t, info(req), { action: 'quote.send', recordType: 'quote', recordId: id, after: { number: disp, channel: body.channel } });
      return { status: 'sent', number: disp, token: link.token };
    });
    if (out.status === 'pending_approval') return void res.status(202).json(out);
    const q = (await ctx.db.get('quotations', id))!;
    void ctx.tasks.enqueue('pdf.render', { kind: 'quote', id });
    const url = 'token' in out && out.token ? shareUrl(ctx, String(out.token)) : null;
    let waUrl: string | null = null;
    if (body.channel === 'whatsapp' && url) {
      const party = await partyInfo(ctx, null, String(q.partyType), String(q.partyId));
      const phone = (party.lead?.phone as string) ?? ((await ctx.db.all('contacts', { where: [['customerId', '==', party.customer?.id ?? '-'], ['isPrimary', '==', true]] }))[0]?.phone as string | undefined);
      const tpl = (await masterItems(ctx, 'messageTemplates')).find((m) => m.key === 'quote');
      const company = await getCompany(ctx);
      if (phone) waUrl = waLink(phone, renderTemplate(String((tpl?.data as { body?: string })?.body ?? 'Quotation {{doc_no}}: {{link}}'), { name: String(party.lead?.name ?? party.customer?.displayName ?? ''), doc_no: String(q.displayNumber), link: url, company: company.tradeName ?? company.legalName }));
    }
    res.json({ status: q.status, number: q.displayNumber, shareUrl: url, waUrl });
  });

  // API-146 Approval (FR-053)
  r.post('/quotes/:id/approval', requirePerm('quote:approve'), async (req, res) => {
    const p = P(req);
    const body = ApprovalBody.parse(req.body);
    const id = String(req.params.id);
    await ctx.db.tx(async (t) => {
      const q = await t.get('quotations', id);
      requireScope(p, 'quote', 'read', q);
      if (q.status !== 'pending_approval') fail('QUOTE_LOCKED', 'This quotation is not waiting for approval');
      if (q.ownerId === p.userId && p.role !== 'admin') fail('SELF_APPROVAL');
      if (p.role === 'sales_manager' && !p.teamUserIds.includes(String(q.ownerId))) fail('FORBIDDEN');
      const approval = { ...(q.approval as object), decision: body.decision, by: p.userId, byName: p.name, at: nowIso(ctx), comment: body.comment ?? null, approvedMaxPct: body.decision === 'approve' ? q.maxDiscountPct : null };
      t.update('quotations', id, { status: body.decision === 'approve' ? 'approved' : 'draft', approval, ...stamp(ctx, p, Number(q.version)) });
      notify(ctx, t, [String(q.ownerId)], 'N-006', `Quotation for ${q.partyName} ${body.decision === 'approve' ? 'approved' : 'rejected'}${body.comment ? `: ${body.comment}` : ''}`, `/sales/quotes/${id}`, [`quote:${id}`]);
      audit(ctx, t, info(req), { action: body.decision === 'approve' ? 'quote.approve' : 'quote.reject_approval', recordType: 'quote', recordId: id, meta: { comment: body.comment } });
    });
    res.json(await ctx.db.get('quotations', id));
  });

  // API-147 Revise (FR-054)
  r.post('/quotes/:id/revise', async (req, res) => {
    const p = P(req);
    const id = String(req.params.id);
    const newQ = newId('q_');
    await ctx.db.tx(async (t) => {
      const q = await t.get('quotations', id);
      requireScope(p, 'quote', 'update', q);
      if (!q.isLatest || !['sent', 'viewed', 'changes_requested', 'rejected', 'expired'].includes(String(q.status))) fail('QUOTE_LOCKED', 'Only the latest sent quotation can be revised');
      const settings = await getSettings(ctx, t);
      const date = istDate(ctx.clock.now());
      const { id: _i, ...rest } = q;
      t.create('quotations', newQ, {
        ...rest, revision: Number(q.revision) + 1, displayNumber: null, isLatest: true, status: 'draft', date, validUntil: addDays(date, Number(q.validDays ?? settings.sales.validDays)),
        approval: null, response: null, viewCount: 0, firstViewedAt: null, lastViewedAt: null, shareLinkId: null, pdf: { status: 'none' }, sentAt: null, revisedFromId: id, ...created(ctx, p),
      });
      t.update('quotations', id, { isLatest: false });
      audit(ctx, t, info(req), { action: 'quote.revise', recordType: 'quote', recordId: newQ, meta: { from: id } });
    });
    res.status(201).json(await ctx.db.get('quotations', newQ));
  });

  // API-148 Compare
  r.get('/quotes/:id/compare', async (req, res) => {
    const a = await ctx.db.get('quotations', String(req.params.id));
    requireScope(P(req), 'quote', 'read', a);
    const b = await ctx.db.get('quotations', String(req.query.with ?? ''));
    if (!b || b.baseId !== a.baseId) fail('NOT_FOUND');
    const la = a.lines as Record<string, unknown>[];
    const lb = b!.lines as Record<string, unknown>[];
    const n = Math.max(la.length, lb.length);
    const lines = Array.from({ length: n }, (_x, i) => ({ index: i, a: la[i] ?? null, b: lb[i] ?? null, changed: JSON.stringify(la[i]) !== JSON.stringify(lb[i]) }));
    res.json({ a: { id: a.id, revision: a.revision, totals: a.totals }, b: { id: b!.id, revision: b!.revision, totals: b!.totals }, lines });
  });

  r.post('/quotes/:id/pdf', async (req, res) => {
    const q = await ctx.db.get('quotations', String(req.params.id));
    requireScope(P(req), 'quote', 'read', q);
    await ctx.tasks.enqueue('pdf.render', { kind: 'quote', id: q.id });
    res.status(202).json({ jobId: null });
  });

  // API-152 Invoice from accepted quote (silent order when Orders module is off, FR-059 AC4)
  r.post('/quotes/:id/create-invoice', requirePerm('invoice:create'), async (req, res) => {
    const p = P(req);
    const id = String(req.params.id);
    const invoiceId = await ctx.db.tx(async (t) => {
      const q = await t.get('quotations', id);
      requireScope(p, 'quote', 'read', q);
      const settings = await getSettings(ctx, t);
      const orderId = q.orderId ? String(q.orderId) : await createOrderFromQuoteTx(ctx, t, q, p, info(req), { hidden: !settings.modules.orders, onBehalfNote: req.body?.onBehalfNote ?? null });
      const company = await getCompany(ctx, t);
      return createInvoiceTx(ctx, t, { type: company.gstRegistered ? 'tax_invoice' : 'bill_of_supply', orderId }, p, info(req));
    });
    res.status(201).json(await ctx.db.get('invoices', invoiceId));
  });

  // ======================= Orders =======================
  r.get('/orders', async (req, res) => {
    const p = P(req);
    const scope = scopeWhere(p, 'order');
    if (!scope) fail('FORBIDDEN');
    const where: Where[] = [...scope!];
    if (str(req.query.status)) where.push(['status', 'in', String(req.query.status).split(',')]);
    if (str(req.query.customerId)) where.push(['customerId', '==', str(req.query.customerId)]);
    res.json(await ctx.db.query('salesOrders', { where, orderBy: [['createdAt', 'desc']], ...paging(req) }));
  });

  r.post('/orders', async (req, res) => {
    const p = P(req);
    requireCan(p, 'order', 'create');
    const body = OrderBody.parse(req.body);
    const orderId = await ctx.db.tx(async (t) => {
      if (body.quoteId) {
        const q = await t.get('quotations', body.quoteId);
        requireScope(p, 'quote', 'read', q);
        const existing = await t.get('orderByQuote', body.quoteId);
        if (existing) return String(existing.orderId);
        return createOrderFromQuoteTx(ctx, t, q, p, info(req), { hidden: false, onBehalfNote: body.onBehalfNote ?? null, expectedDelivery: body.expectedDelivery, customerPoRef: body.customerPoRef });
      }
      if (!body.customerId || !body.lines?.length) fail('VALIDATION_FAILED', 'Choose a customer and add lines');
      const c = await t.get('customers', body.customerId!);
      requireScope(p, 'customer', 'read', c);
      const company = await getCompany(ctx, t);
      const settings = await getSettings(ctx, t);
      const pos = placeOfSupply({ kind: settings.sales.supplyKind, companyState: company.stateCode, billingState: (c.billingStateCode as string) || null });
      const calc = await computeLines(ctx, t, body.lines!, pos);
      return insertOrder(ctx, t, { quoteId: null, customerId: c.id, ownerId: p.role === 'sales_exec' ? p.userId : String(c.ownerId), lines: calc.lines, totals: calc.totals as unknown as Record<string, unknown>, placeOfSupply: pos, intraState: calc.intraState, hidden: false, expectedDelivery: body.expectedDelivery ?? null, customerPoRef: body.customerPoRef ?? null, notes: body.notes ?? null }, p, info(req));
    });
    res.status(201).json(await ctx.db.get('salesOrders', orderId));
  });

  r.get('/orders/:id', async (req, res) => {
    const o = await ctx.db.get('salesOrders', String(req.params.id));
    requireScope(P(req), 'order', 'read', o);
    const lines = (o.lines as Record<string, number & unknown>[]).map((l) => ({ ...l, pendingQty: pendingQty({ qty: Number(l.qty), invoicedQty: Number(l.invoicedQty ?? 0), creditedQty: Number(l.creditedQty ?? 0) }) }));
    const invoices = await ctx.db.all('invoices', { where: [['orderId', '==', o.id]] });
    const total = Number((o.totals as { grandTotal: number }).grandTotal) || 1;
    const invoiced = invoices.filter((i) => i.type !== 'proforma' && i.status !== 'draft').reduce((s, i) => s + Number((i.totals as { grandTotal: number }).grandTotal) - Number(i.credited ?? 0), 0);
    const received = invoices.reduce((s, i) => s + Number(i.paid ?? 0), 0);
    res.json({ ...o, lines, invoices: invoices.map((i) => ({ id: i.id, number: i.number, type: i.type, status: i.status, grandTotal: (i.totals as { grandTotal: number }).grandTotal, balanceDue: i.balanceDue })), invoicedPct: Math.round((invoiced / total) * 100), receivedPct: Math.round((received / total) * 100), balanceToInvoice: Math.max(0, total - invoiced) });
  });

  r.patch('/orders/:id', async (req, res) => {
    const p = P(req);
    const id = String(req.params.id);
    const body = OrderBody.pick({ expectedDelivery: true, customerPoRef: true, notes: true }).parse(req.body);
    await ctx.db.tx(async (t) => {
      const o = await t.get('salesOrders', id);
      requireScope(p, 'order', 'update', o);
      checkVersion(o, req.header('if-match'));
      t.update('salesOrders', id, { ...body, ...stamp(ctx, p, Number(o.version)) });
      audit(ctx, t, info(req), { action: 'order.update', recordType: 'order', recordId: id, before: o, after: { ...o, ...body } });
    });
    res.json(await ctx.db.get('salesOrders', id));
  });

  // API-157 Status (FR-060, RULE-032)
  r.post('/orders/:id/status', requirePerm('order:status'), async (req, res) => {
    const p = P(req);
    const body = OrderStatusBody.parse(req.body);
    const id = String(req.params.id);
    await ctx.db.tx(async (t) => {
      const o = await t.get('salesOrders', id);
      if (p.role === 'project_manager') requireScope(p, 'order', 'update', o);
      else requireScope(p, 'order', p.role === 'admin' || p.role === 'support' ? 'read' : 'update', o);
      if (!canOrderTransition(String(o.status), body.status)) fail('ORDER_STATUS_INVALID');
      if (body.status === 'cancelled') {
        if (!body.reason) fail('REASON_REQUIRED');
        const inv = (await t.query('invoices', { where: [['orderId', '==', id]], limit: 200 })).items;
        if (inv.some((i) => i.type !== 'proforma' && ['issued', 'partly_paid', 'paid'].includes(String(i.status)))) fail('ORDER_HAS_INVOICES');
      }
      const history = [...((o.statusHistory as unknown[]) ?? []), { from: o.status, to: body.status, at: nowIso(ctx), by: p.userId, reason: body.reason ?? null }];
      t.update('salesOrders', id, { status: body.status, statusHistory: history, ...stamp(ctx, p, Number(o.version)) });
      if (['cancelled', 'closed'].includes(body.status) && ['confirmed', 'in_progress', 'on_hold', 'delivered'].includes(String(o.status))) await applyCustomerDelta(t, String(o.customerId), { activeOrders: body.status === 'cancelled' || body.status === 'closed' ? -1 : 0 });
      audit(ctx, t, info(req), { action: 'order.status', recordType: 'order', recordId: id, before: { status: o.status }, after: { status: body.status }, meta: { reason: body.reason } });
    });
    const o = (await ctx.db.get('salesOrders', id))!;
    const fully = (o.lines as { qty: number; invoicedQty?: number; creditedQty?: number }[]).every((l) => pendingQty({ qty: l.qty, invoicedQty: l.invoicedQty ?? 0, creditedQty: l.creditedQty ?? 0 }) === 0);
    res.json({ ...o, promptClose: o.status === 'delivered' && fully });
  });

  // ======================= Invoices =======================
  r.get('/invoices', async (req, res) => {
    const p = P(req);
    const scope = scopeWhere(p, 'invoice');
    if (!scope) fail('FORBIDDEN');
    const where: Where[] = [...scope!];
    if (str(req.query.type)) where.push(['type', '==', str(req.query.type)]);
    if (str(req.query.status)) where.push(['status', 'in', String(req.query.status).split(',')]);
    if (str(req.query.customerId)) where.push(['customerId', '==', str(req.query.customerId)]);
    if (req.query.overdue === '1') {
      where.push(['status', 'in', ['issued', 'partly_paid']]);
      where.push(['dueDate', '<', istDate(ctx.clock.now())]);
    }
    res.json(await ctx.db.query('invoices', { where, orderBy: [[req.query.overdue === '1' ? 'dueDate' : 'createdAt', req.query.overdue === '1' ? 'asc' : 'desc']], ...paging(req) }));
  });

  r.post('/invoices', requirePerm('invoice:create'), async (req, res) => {
    const p = P(req);
    const body = InvoiceBody.parse(req.body);
    const id = await ctx.db.tx(async (t) => {
      if (body.quoteId && !body.orderId) {
        const q = await t.get('quotations', body.quoteId);
        requireScope(p, 'quote', 'read', q);
        if (body.type === 'proforma') return createInvoiceTx(ctx, t, { ...body, manualLines: q.lines as LineBody[], customerId: String(q.customerId ?? ''), quoteId: q.id }, p, info(req));
        const settings = await getSettings(ctx, t);
        const orderId = q.orderId ? String(q.orderId) : await createOrderFromQuoteTx(ctx, t, q, p, info(req), { hidden: !settings.modules.orders, onBehalfNote: null });
        return createInvoiceTx(ctx, t, { ...body, orderId }, p, info(req));
      }
      return createInvoiceTx(ctx, t, body, p, info(req));
    });
    res.status(201).json(await ctx.db.get('invoices', id));
  });

  r.get('/invoices/:id', async (req, res) => {
    const i = await ctx.db.get('invoices', String(req.params.id));
    requireScope(P(req), 'invoice', 'read', i);
    const [allocs, cns] = await Promise.all([ctx.db.all('allocations', { where: [['invoiceId', '==', i.id], ['active', '==', true]] }), ctx.db.all('creditNotes', { where: [['invoiceId', '==', i.id]] })]);
    res.setHeader('ETag', String(i.version));
    res.json({ ...i, allocations: allocs, creditNotes: cns });
  });

  r.patch('/invoices/:id', requirePerm('invoice:create'), async (req, res) => {
    const p = P(req);
    const body = InvoicePatchBody.parse(req.body);
    const id = String(req.params.id);
    await ctx.db.tx(async (t) => {
      const i = await t.get('invoices', id);
      requireScope(p, 'invoice', 'read', i);
      checkVersion(i, req.header('if-match'));
      if (i.status !== 'draft') {
        // FR-065 AC1: only notes on issued invoices
        if (Object.keys(body).some((k) => k !== 'notes')) fail('DOCUMENT_ISSUED');
        t.update('invoices', id, { notes: body.notes ?? null, ...stamp(ctx, p, Number(i.version)) });
        return;
      }
      const pos = body.placeOfSupply ?? String(i.placeOfSupply);
      let lines = i.lines as LineBody[];
      if (body.lines && i.orderId) lines = await orderLinesToInvoiceLines(t, String(i.orderId), body.lines);
      else if (body.manualLines) lines = body.manualLines;
      const calc = await computeLines(ctx, t, lines, pos, 0, { gstOverride: i.type !== 'bill_of_supply' && (await getCompany(ctx, t)).gstRegistered });
      const date = body.date ?? String(i.date);
      t.update('invoices', id, { lines: calc.lines, totals: calc.totals, placeOfSupply: pos, intraState: calc.intraState, date, dueDate: dueDate(date, Number(i.termDays ?? 0)), balanceDue: calc.totals.grandTotal, notes: body.notes ?? i.notes, ...stamp(ctx, p, Number(i.version)) });
      audit(ctx, t, info(req), { action: 'invoice.update', recordType: 'invoice', recordId: id, before: { totals: i.totals }, after: { totals: calc.totals } });
    });
    res.json(await ctx.db.get('invoices', id));
  });

  r.delete('/invoices/:id', requirePerm('invoice:create'), async (req, res) => {
    const p = P(req);
    const id = String(req.params.id);
    await ctx.db.tx(async (t) => {
      const i = await t.get('invoices', id);
      requireScope(p, 'invoice', 'read', i);
      if (i.status !== 'draft') fail('DOCUMENT_ISSUED');
      t.delete('invoices', id);
      audit(ctx, t, info(req), { action: 'invoice.delete', recordType: 'invoice', recordId: id });
    });
    res.status(204).end();
  });

  // API-164 Issue (FR-064, FR-065)
  r.post('/invoices/:id/issue', requirePerm('invoice:issue'), async (req, res) => {
    const p = P(req);
    const id = String(req.params.id);
    await ctx.db.tx(async (t) => issueInvoiceTx(ctx, t, id, p, info(req), req.header('if-match')));
    void ctx.tasks.enqueue('pdf.render', { kind: 'invoice', id });
    res.json(await ctx.db.get('invoices', id));
  });

  // API-165 Credit note (FR-066, RULE-038)
  r.post('/invoices/:id/credit-notes', requirePerm('invoice:credit'), async (req, res) => {
    const p = P(req);
    const body = CreditNoteBody.parse(req.body);
    const id = String(req.params.id);
    const cnId = await ctx.db.tx(async (t) => {
      const i = await t.get('invoices', id);
      requireScope(p, 'invoice', 'read', i);
      if (!['issued', 'partly_paid', 'paid', 'cancelled'].includes(String(i.status)) || i.type === 'proforma') fail('VALIDATION_FAILED', 'Credit notes need an issued tax invoice or bill of supply');
      const settings = await getSettings(ctx, t);
      const date = body.date ?? istDate(ctx.clock.now());
      if (settings.finance.lockDate && date <= settings.finance.lockDate) fail('PERIOD_LOCKED');
      const grand = Number((i.totals as { grandTotal: number }).grandTotal);
      const lines = i.lines as (LineBody & { total: number; cgst: number; sgst: number; igst: number; taxable: number; orderLineId?: string })[];
      let amount = 0;
      const creditLines: { index: number; qty: number; amount: number }[] = [];
      if (body.mode === 'full') amount = grand - Number(i.credited ?? 0);
      else if (body.mode === 'amount') amount = body.amount ?? 0;
      else {
        for (const cl of body.lines ?? []) {
          const l = lines[cl.index];
          if (!l || l.kind === 'heading' || cl.qty > Number(l.qty)) fail('VALIDATION_FAILED', `Line ${cl.index + 1} quantity is too high`);
          const part = roundHalfUp((Number(l!.total) * cl.qty) / Number(l!.qty));
          creditLines.push({ index: cl.index, qty: cl.qty, amount: part });
          amount += part;
        }
      }
      const eff = creditNoteEffect({ grandTotal: grand, paid: Number(i.paid ?? 0), credited: Number(i.credited ?? 0) }, amount);
      if (!eff.ok) fail('CREDIT_EXCEEDS_TOTAL');
      const number = await nextDocNumber(t, 'credit_note', date);
      const ratio = amount / grand;
      const tax = i.totals as { cgst: number; sgst: number; igst: number };
      const cnId = newId('cn_');
      t.create('creditNotes', cnId, {
        number, invoiceId: id, invoiceNumber: i.number, customerId: i.customerId, ownerId: i.ownerId, date, reason: body.reason, mode: body.mode, lines: creditLines, amount,
        taxSplit: { cgst: roundHalfUp(tax.cgst * ratio), sgst: roundHalfUp(tax.sgst * ratio), igst: roundHalfUp(tax.igst * ratio) }, onAccountCredit: eff.onAccount, ...created(ctx, p),
      });
      const credited = Number(i.credited ?? 0) + amount;
      const next = { grandTotal: grand, paid: Number(i.paid ?? 0), credited };
      const status = invoiceStatus(next);
      t.update('invoices', id, { credited, balanceDue: balanceDue(next), status, ...(status === 'cancelled' ? { cancelledByCnId: cnId, cancelledByNumber: number } : {}), pdf: { ...(i.pdf as object), status: 'pending' }, ...stamp(ctx, p, Number(i.version)) });
      // restore order quantities (FR-061 AC2)
      if (i.orderId && (body.mode === 'full' || body.mode === 'lines')) {
        const o = await t.get('salesOrders', String(i.orderId));
        if (o) {
          const olines = (o.lines as Record<string, unknown>[]).map((ol) => ({ ...ol }));
          const credits = body.mode === 'full' ? lines.map((l, idx) => ({ index: idx, qty: Number(l.qty) })) : creditLines;
          for (const c of credits) {
            const il = lines[c.index];
            const ol = olines.find((x) => x.id === il?.orderLineId);
            if (ol) ol.creditedQty = Number(ol.creditedQty ?? 0) + c.qty;
          }
          t.update('salesOrders', o.id, { lines: olines });
        }
      }
      const appliedToBalance = amount - eff.onAccount;
      await applyCustomerDelta(t, String(i.customerId), { credited: appliedToBalance, advance: eff.onAccount });
      postLedger(ctx, t, { customerId: String(i.customerId), date, kind: 'credit_note', docId: cnId, docNumber: number, debit: 0, credit: amount });
      addActivity(ctx, t, { recordType: 'customer', recordId: String(i.customerId), ownerId: String(i.ownerId), type: 'invoice', note: `Credit note ${number} for ₹${(amount / 100).toFixed(2)} on ${i.number}: ${body.reason}`, meta: { invoiceId: id, creditNoteId: cnId }, ...actor(p) });
      audit(ctx, t, info(req), { action: 'credit_note.issue', recordType: 'invoice', recordId: id, meta: { number, amount, reason: body.reason, onAccount: eff.onAccount } });
      return cnId;
    });
    void ctx.tasks.enqueue('pdf.render', { kind: 'invoice', id });
    void ctx.tasks.enqueue('pdf.render', { kind: 'credit_note', id: cnId });
    res.status(201).json(await ctx.db.get('creditNotes', cnId));
  });

  r.get('/credit-notes/:id', async (req, res) => {
    const c = await ctx.db.get('creditNotes', String(req.params.id));
    requireScope(P(req), 'invoice', 'read', c);
    res.json(c);
  });

  // API-167 Convert proforma (FR-063 AC2)
  r.post('/invoices/:id/convert', requirePerm('invoice:create'), async (req, res) => {
    const p = P(req);
    const id = String(req.params.id);
    const newIdOut = await ctx.db.tx(async (t) => {
      const pi = await t.get('invoices', id);
      requireScope(p, 'invoice', 'read', pi);
      if (pi.type !== 'proforma' || pi.status !== 'issued') fail('VALIDATION_FAILED', 'Only an issued proforma can be converted');
      const company = await getCompany(ctx, t);
      const out = await createInvoiceTx(ctx, t, { type: company.gstRegistered ? 'tax_invoice' : 'bill_of_supply', orderId: (pi.orderId as string) ?? undefined, customerId: String(pi.customerId), manualLines: pi.orderId ? undefined : (pi.lines as LineBody[]), lines: pi.orderId ? (pi.lines as { orderLineId: string; qty: number }[]).filter((l) => l.orderLineId).map((l) => ({ orderLineId: l.orderLineId, qty: Number(l.qty) })) : undefined, quoteId: (pi.quoteId as string) ?? undefined }, p, info(req), { fromProformaId: id });
      t.update('invoices', id, { status: 'converted', convertedToId: out, ...stamp(ctx, p, Number(pi.version)) });
      return out;
    });
    res.status(201).json(await ctx.db.get('invoices', newIdOut));
  });

  r.post('/invoices/:id/pdf', async (req, res) => {
    const i = await ctx.db.get('invoices', String(req.params.id));
    requireScope(P(req), 'invoice', 'read', i);
    await ctx.tasks.enqueue('pdf.render', { kind: 'invoice', id: i.id });
    res.status(202).json({ jobId: null });
  });

  // API-169 UPI payload + QR for the current balance (FR-068)
  r.get('/invoices/:id/upi', async (req, res) => {
    const i = await ctx.db.get('invoices', String(req.params.id));
    requireScope(P(req), 'invoice', 'read', i);
    res.json(await upiFor(ctx, i));
  });

  return r;
}

export async function upiFor(ctx: Ctx, i: Doc) {
  const upi = (i.upi as { vpa?: string; payee?: string; trEnabled?: boolean } | null) ?? null;
  let amount = Number(i.balanceDue ?? 0);
  if (i.type === 'proforma') {
    const adv = Number(i.advancePct ?? 0);
    const grand = Number((i.totals as { grandTotal: number }).grandTotal);
    amount = adv > 0 ? roundHalfUp((grand * adv) / 100) : grand; // FR-068 AC8
  }
  if (!upi?.vpa || amount <= 0 || !i.number) return { uri: null, amount, qrSvg: null, paid: amount <= 0 && i.status !== 'draft' };
  const uri = buildUpiUri({ vpa: upi.vpa, payeeName: upi.payee ?? '', amount, docNumber: String(i.number), trEnabled: upi.trEnabled !== false });
  return { uri, amount, qrSvg: await upiQrSvg(uri), paid: false };
}

// ---------------- helpers used by several flows ----------------

async function createOrderFromQuoteTx(ctx: Ctx, t: Tx, q: Doc, p: Principal, ri: ReqInfo, opts: { hidden: boolean; onBehalfNote: string | null; expectedDelivery?: string | null; customerPoRef?: string | null }) {
  const existing = await t.get('orderByQuote', q.id);
  if (existing) return String(existing.orderId);
  if (q.status !== 'accepted') {
    if (!['sent', 'viewed'].includes(String(q.status))) fail('QUOTE_NOT_ACCEPTABLE');
    if (!opts.onBehalfNote) fail('ACCEPT_ON_BEHALF_NOTE_REQUIRED');
    t.update('quotations', q.id, { status: 'accepted', response: { type: 'accept', onBehalf: true, by: p.userId, note: opts.onBehalfNote, at: nowIso(ctx) } });
    audit(ctx, t, ri, { action: 'quote.accept_on_behalf', recordType: 'quote', recordId: q.id, meta: { note: opts.onBehalfNote } });
  }
  let customerId = (q.customerId as string) ?? null;
  if (!customerId && q.leadId) {
    customerId = (await convertLead(ctx, t, String(q.leadId), { mode: 'new' }, null, ri)).customerId;
    t.update('quotations', q.id, { customerId });
  }
  return insertOrder(ctx, t, { quoteId: q.id, customerId: customerId!, ownerId: String(q.ownerId), lines: q.lines as LineBody[], totals: q.totals as Record<string, unknown>, placeOfSupply: String(q.placeOfSupply), intraState: !!q.intraState, hidden: opts.hidden, expectedDelivery: opts.expectedDelivery ?? null, customerPoRef: opts.customerPoRef ?? null, notes: null, paymentTermId: (q.paymentTermId as string) ?? null }, p, ri);
}

async function insertOrder(ctx: Ctx, t: Tx, o: { quoteId: string | null; customerId: string; ownerId: string; lines: LineBody[]; totals: Record<string, unknown>; placeOfSupply: string; intraState: boolean; hidden: boolean; expectedDelivery: string | null; customerPoRef: string | null; notes: string | null; paymentTermId?: string | null }, p: Principal, ri: ReqInfo) {
  const id = newId('so_');
  const date = istDate(ctx.clock.now());
  const number = await nextDocNumber(t, 'order', date);
  const lines = o.lines.map((l, i) => ({ ...l, id: `ol${i + 1}`, invoicedQty: 0, creditedQty: 0 }));
  t.create('salesOrders', id, { number, date, quoteId: o.quoteId, customerId: o.customerId, ownerId: o.ownerId, hidden: o.hidden, status: 'confirmed', statusHistory: [{ to: 'confirmed', at: nowIso(ctx), by: p.userId }], expectedDelivery: o.expectedDelivery, customerPoRef: o.customerPoRef, notes: o.notes, paymentTermId: o.paymentTermId ?? null, lines, totals: o.totals, placeOfSupply: o.placeOfSupply, intraState: o.intraState, searchTokens: searchTokens({ docNumbers: [number] }), ...created(ctx, p) });
  if (o.quoteId) {
    t.create('orderByQuote', o.quoteId, { orderId: id });
    t.update('quotations', o.quoteId, { orderId: id });
  }
  await applyCustomerDelta(t, o.customerId, { activeOrders: 1 });
  addActivity(ctx, t, { recordType: 'customer', recordId: o.customerId, ownerId: o.ownerId, type: 'system', note: `Order ${number} created`, meta: { orderId: id }, ...actor(p) });
  audit(ctx, t, ri, { action: 'order.create', recordType: 'order', recordId: id, after: { number, quoteId: o.quoteId, hidden: o.hidden } });
  return id;
}

async function orderLinesToInvoiceLines(t: Tx, orderId: string, picks?: { orderLineId: string; qty: number }[]) {
  const o = await t.get('salesOrders', orderId);
  if (!o) fail('NOT_FOUND');
  const olines = o!.lines as (LineBody & { id: string; invoicedQty: number; creditedQty: number })[];
  const chosen = picks ?? olines.filter((l) => l.kind !== 'heading').map((l) => ({ orderLineId: l.id, qty: pendingQty({ qty: Number(l.qty), invoicedQty: l.invoicedQty, creditedQty: l.creditedQty }) })).filter((x) => x.qty > 0);
  const out: LineBody[] = [];
  for (const c of chosen) {
    const ol = olines.find((l) => l.id === c.orderLineId);
    if (!ol) fail('VALIDATION_FAILED', 'Unknown order line');
    const pending = pendingQty({ qty: Number(ol!.qty), invoicedQty: ol!.invoicedQty, creditedQty: ol!.creditedQty });
    if (c.qty > pending + 1e-9) throw new AppError('INVOICE_QTY_EXCEEDS_PENDING', `Only ${pending} left to invoice`, { pending, orderLineId: ol!.id });
    const discountAmt = ol!.discountAmt != null ? roundHalfUp((Number(ol!.discountAmt) * c.qty) / Number(ol!.qty)) : null;
    out.push({ ...ol!, qty: c.qty, discountAmt, orderLineId: ol!.id } as LineBody);
  }
  return out;
}

export async function createInvoiceTx(ctx: Ctx, t: Tx, body: { type: 'tax_invoice' | 'bill_of_supply' | 'proforma'; orderId?: string; quoteId?: string; customerId?: string; date?: string; lines?: { orderLineId: string; qty: number }[]; manualLines?: LineBody[]; notes?: string | null; placeOfSupply?: string }, p: Principal, ri: ReqInfo, extra: { fromProformaId?: string } = {}) {
  const company = await getCompany(ctx, t);
  if (body.type === 'tax_invoice' && !company.gstRegistered) fail('VALIDATION_FAILED', 'Tax invoices need a GST-registered company — use Bill of Supply');
  if (body.type === 'bill_of_supply' && company.gstRegistered) fail('VALIDATION_FAILED', 'GST-registered companies issue Tax Invoices');
  let customerId = body.customerId ?? null;
  let ownerId = p.userId;
  let lines: LineBody[];
  let paymentTermId: string | null = null;
  if (body.orderId) {
    const o = await t.get('salesOrders', body.orderId);
    if (!o) fail('NOT_FOUND');
    customerId = String(o!.customerId);
    ownerId = String(o!.ownerId);
    paymentTermId = (o!.paymentTermId as string) ?? null;
    lines = await orderLinesToInvoiceLines(t, body.orderId, body.lines);
    if (!lines.length) fail('INVOICE_QTY_EXCEEDS_PENDING', 'Nothing left to invoice on this order');
  } else {
    if (!customerId || !body.manualLines?.length) fail('VALIDATION_FAILED', 'Choose a customer and add lines');
    lines = body.manualLines!;
  }
  const c = await t.get('customers', customerId!);
  if (!c) fail('NOT_FOUND');
  ownerId = body.orderId ? ownerId : String(c!.ownerId);
  const settings = await getSettings(ctx, t);
  const pos = body.placeOfSupply ?? placeOfSupply({ kind: settings.sales.supplyKind, companyState: company.stateCode, billingState: (c!.billingStateCode as string) || null });
  const calc = await computeLines(ctx, t, lines, pos, 0, { gstOverride: body.type !== 'bill_of_supply' && company.gstRegistered });
  const date = body.date ?? istDate(ctx.clock.now());
  if (settings.finance.lockDate && date <= settings.finance.lockDate) fail('PERIOD_LOCKED');
  const term = paymentTermId ? await t.get('masters', paymentTermId) : null;
  const termDays = Number((term?.data as { days?: number } | undefined)?.days ?? c!.creditDays ?? 0);
  const advancePct = Number((term?.data as { advancePct?: number } | undefined)?.advancePct ?? 0);
  const billing = (await t.query('addresses', { where: [['customerId', '==', c!.id], ['type', '==', 'billing']], limit: 5 })).items[0] ?? null;
  const shipping = (await t.query('addresses', { where: [['customerId', '==', c!.id], ['type', '==', 'shipping']], limit: 5 })).items[0] ?? null;
  const addr = (a: Doc | null) => (a ? [a.line1, a.line2, a.city, a.pincode].filter(Boolean).join(', ') : null);
  const id = newId('inv_');
  t.create('invoices', id, {
    type: body.type, number: null, status: 'draft', orderId: body.orderId ?? null, quoteId: body.quoteId ?? null, customerId: c!.id, customerName: c!.displayName, ownerId,
    date, termDays, dueDate: dueDate(date, termDays), placeOfSupply: pos, intraState: calc.intraState, advancePct,
    billTo: { name: c!.legalName ?? c!.displayName, address: addr(billing), gstin: c!.gstin ?? null, stateCode: billing?.stateCode ?? c!.billingStateCode ?? null },
    shipTo: shipping ? { name: c!.displayName, address: addr(shipping), stateCode: shipping.stateCode } : null,
    lines: calc.lines, totals: calc.totals, paid: 0, tds: 0, credited: 0, balanceDue: calc.totals.grandTotal, upi: null, pdf: { status: 'none' }, notes: body.notes ?? null,
    fromProformaId: extra.fromProformaId ?? null, searchTokens: searchTokens({ names: [c!.displayName as string] }), ...created(ctx, p),
  });
  audit(ctx, t, ri, { action: 'invoice.create', recordType: 'invoice', recordId: id, after: { type: body.type, orderId: body.orderId ?? null, grandTotal: calc.totals.grandTotal } });
  return id;
}

export async function issueInvoiceTx(ctx: Ctx, t: Tx, id: string, p: Principal, ri: ReqInfo, ifMatch?: string) {
  const i = await t.get('invoices', id);
  requireScope(p, 'invoice', 'read', i);
  if (i.status !== 'draft') fail('DOCUMENT_ISSUED');
  if (ifMatch !== undefined) checkVersion(i, ifMatch);
  const settings = await getSettings(ctx, t);
  const company = await getCompany(ctx, t);
  if (settings.finance.lockDate && String(i.date) <= settings.finance.lockDate) fail('PERIOD_LOCKED');
  const lines = i.lines as (LineBody & { orderLineId?: string })[];
  if (i.type === 'tax_invoice') {
    const bad = lines.findIndex((l) => l.kind !== 'heading' && !(l.hsnSac && (HSN_PATTERN.test(l.hsnSac) || SAC_PATTERN.test(l.hsnSac))));
    if (bad >= 0) throw new AppError('HSN_SAC_REQUIRED', `Add an HSN/SAC code to line ${bad + 1}.`, { line: bad + 1 });
  }
  // RULE-033 re-check at issue (another invoice may have consumed quantity)
  if (i.orderId && i.type !== 'proforma') {
    const o = await t.get('salesOrders', String(i.orderId));
    const olines = (o!.lines as Record<string, unknown>[]).map((x) => ({ ...x }));
    for (const l of lines) {
      if (!l.orderLineId) continue;
      const ol = olines.find((x) => x.id === l.orderLineId)!;
      const pending = pendingQty({ qty: Number(ol.qty), invoicedQty: Number(ol.invoicedQty ?? 0), creditedQty: Number(ol.creditedQty ?? 0) });
      if (Number(l.qty) > pending + 1e-9) throw new AppError('INVOICE_QTY_EXCEEDS_PENDING', `Only ${pending} left to invoice`, { pending });
      ol.invoicedQty = Number(ol.invoicedQty ?? 0) + Number(l.qty);
    }
    t.update('salesOrders', o!.id, { lines: olines });
  }
  const number = await nextDocNumber(t, i.type as DocType, String(i.date));
  const upis = (await t.query('masters', { where: [['type', '==', 'upiIds'], ['status', '==', 'active']], limit: 20 })).items;
  const upi = upis.find((u) => u.isDefault) ?? upis[0] ?? null;
  const upiSnap = upi ? { vpaId: upi.id, vpa: (upi.data as { vpa: string }).vpa, payee: (upi.data as { payeeName: string }).payeeName, trEnabled: (upi.data as { trEnabled?: boolean }).trEnabled !== false } : null;
  const banks = (await t.query('masters', { where: [['type', '==', 'bankAccounts'], ['status', '==', 'active']], limit: 20 })).items;
  const bank = banks.find((b) => b.isDefault) ?? banks[0] ?? null;
  const grand = Number((i.totals as { grandTotal: number }).grandTotal);
  t.update('invoices', id, {
    number, status: 'issued', issuedAt: nowIso(ctx), company: { ...company }, upi: upiSnap, bank: bank ? bank.data : null, balanceDue: grand,
    searchTokens: searchTokens({ docNumbers: [number], names: [i.customerName as string] }), pdf: { status: 'pending', attempts: 0, version: 0 }, ...stamp(ctx, p, Number(i.version)),
  });
  if (upi) markInUse(t, [upi.id]);
  markInUse(t, lines.map((l) => l.productId));
  if (i.type !== 'proforma') {
    await applyCustomerDelta(t, String(i.customerId), { invoiced: grand });
    postLedger(ctx, t, { customerId: String(i.customerId), date: String(i.date), kind: 'invoice', docId: id, docNumber: number, debit: grand, credit: 0 });
  }
  addActivity(ctx, t, { recordType: 'customer', recordId: String(i.customerId), ownerId: String(i.ownerId), type: 'invoice', note: `${i.type === 'proforma' ? 'Proforma' : 'Invoice'} ${number} issued for ₹${(grand / 100).toFixed(2)}`, meta: { invoiceId: id }, ...actor(p) });
  audit(ctx, t, ri, { action: 'invoice.issue', recordType: 'invoice', recordId: id, after: { number, grandTotal: grand } });
  return number;
}

/** Public customer response (FR-057). Called from the documents public route with the resolved link. */
export async function respondToQuote(ctx: Ctx, quoteId: string, body: ReturnType<typeof RespondBody.parse>, ip: string, req: Request) {
  return ctx.db.tx(async (t) => {
    const q = await t.get('quotations', quoteId);
    if (!q) fail('NOT_FOUND');
    const today = istDate(ctx.clock.now());
    if (q!.status === 'accepted' && body.type === 'accept') return { status: 'accepted', duplicate: true }; // AC4 double tap
    if (body.type === 'accept') {
      if (!canAccept({ status: String(q!.status), isLatest: !!q!.isLatest, validUntil: String(q!.validUntil) }, today)) {
        if (today > String(q!.validUntil)) fail('QUOTE_EXPIRED');
        fail('QUOTE_NOT_ACCEPTABLE');
      }
      if (!body.name || body.name.trim().length < 2) fail('VALIDATION_FAILED', 'Type your name to accept');
    } else {
      if (!q!.isLatest || !['sent', 'viewed'].includes(String(q!.status)) || today > String(q!.validUntil)) fail('QUOTE_NOT_ACCEPTABLE');
      if (body.type === 'changes' && !body.comment) fail('VALIDATION_FAILED', 'Tell us what to change');
    }
    const status = body.type === 'accept' ? 'accepted' : body.type === 'changes' ? 'changes_requested' : 'rejected';
    const response = { type: body.type, name: body.name ?? null, comment: body.comment ?? null, at: nowIso(ctx), ipMasked: ip.replace(/\.\d+$/, '.x') };
    t.update('quotations', quoteId, { status, response, version: Number(q!.version) + 1, updatedAt: nowIso(ctx) });
    const ri = { principal: null, ip, requestId: req.id, actorOverride: 'public' };
    if (status === 'accepted' && q!.leadId) {
      const l = await t.get('leads', String(q!.leadId));
      if (l && l.stage !== 'won') {
        const out = await convertLead(ctx, t, l.id, l.customerId ? { mode: 'link', customerId: String(l.customerId) } : { mode: 'new' }, null, ri);
        t.update('quotations', quoteId, { customerId: out.customerId });
      }
    }
    const recordType = q!.customerId ? 'customer' : 'lead';
    addActivity(ctx, t, { recordType, recordId: String(q!.customerId ?? q!.leadId), ownerId: String(q!.ownerId), customerId: (q!.customerId as string) ?? null, type: 'quote', note: `Customer ${status.replace('_', ' ')} ${q!.displayNumber}${body.comment ? `: ${body.comment}` : ''}`, meta: { quoteId }, userId: 'public', userName: body.name ?? 'Customer' });
    const managers = (await t.query('teams', { where: [['memberIds', 'array-contains', String(q!.ownerId)]], limit: 10 })).items.map((x) => String(x.managerId));
    const settings = await getSettings(ctx, t);
    notify(ctx, t, [String(q!.ownerId), ...(settings.mode.mode === 'team' ? managers : [])], 'N-008', `${q!.partyName} ${status === 'accepted' ? 'accepted' : status === 'rejected' ? 'rejected' : 'requested changes to'} ${q!.displayNumber}`, `/sales/quotes/${quoteId}`, [`quote:${quoteId}`]);
    audit(ctx, t, ri, { action: 'quote.respond', recordType: 'quote', recordId: quoteId, meta: { type: body.type } });
    return { status };
  });
}

/** Daily job: expire quotes past validity (FR-058 AC2). */
export async function expireQuotes(ctx: Ctx) {
  const today = istDate(ctx.clock.now());
  const due = await ctx.db.all('quotations', { where: [['status', 'in', ['sent', 'viewed', 'changes_requested']], ['validUntil', '<', today]] });
  for (const q of due) {
    await ctx.db.tx(async (t) => {
      t.update('quotations', q.id, { status: 'expired' });
      audit(ctx, t, { principal: null }, { action: 'quote.expire', recordType: 'quote', recordId: q.id });
    });
  }
  return due.length;
}

