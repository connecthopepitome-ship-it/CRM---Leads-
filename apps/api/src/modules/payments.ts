import { Router } from 'express';
import { ApplyAdvanceBody, PaymentBody, ReverseBody, hasPermission, scopeOf } from '@ss/contracts';
import { autoAllocate, balanceDue, daysBetween, invoiceStatus, istDate, normaliseRef, referenceRequired, searchTokens, validateManual, type OpenInvoice } from '@ss/domain';
import type { Ctx, Principal } from '../context.js';
import type { Doc, Tx, Where } from '../db/types.js';
import { AppError, fail } from '../http/errors.js';
import { authn, info, P, paging, requirePerm, str } from '../http/pipeline.js';
import { audit, created, getSettings, nextDocNumber, notify, nowIso, newId, requireScope, scopeWhere, stamp, type ReqInfo } from '../shared/core.js';
import { actor, addActivity, idempotent } from '../shared/records.js';
import { applyCustomerDelta, postLedger } from './customers.js';

type Body = ReturnType<typeof PaymentBody.parse>;

async function openInvoices(t: Tx, customerId: string) {
  return (await t.query('invoices', { where: [['customerId', '==', customerId], ['status', 'in', ['issued', 'partly_paid']]], limit: 500 })).items.filter((i) => i.type !== 'proforma');
}

function canRecord(p: Principal, execEnabled: boolean) {
  if (scopeOf(p.role, 'payment', 'create') === 'none') return false;
  if (p.role === 'sales_exec' && !execEnabled) return false; // RULE-048
  return true;
}

/** Applies allocations to invoices inside the tx (RULE-040, RULE-044). */
function applyToInvoice(ctx: Ctx, t: Tx, inv: Doc, amount: number, today: string) {
  const grand = Number((inv.totals as { grandTotal: number }).grandTotal);
  const paid = Number(inv.paid ?? 0) + amount;
  const next = { grandTotal: grand, paid, credited: Number(inv.credited ?? 0) };
  const bal = balanceDue(next);
  const status = invoiceStatus(next);
  t.update('invoices', inv.id, { paid, balanceDue: bal, status, ...(bal === 0 ? { paidAt: today } : { paidAt: null }), pdf: { ...(inv.pdf as object), status: 'pending' }, version: Number(inv.version) + 1, updatedAt: nowIso(ctx) });
  return { bal, settledDays: bal === 0 ? daysBetween(String(inv.date), today) : null };
}

export async function recordPaymentTx(ctx: Ctx, t: Tx, body: Body, p: Principal, ri: ReqInfo) {
  const settings = await getSettings(ctx, t);
  const today = istDate(ctx.clock.now());
  if (body.date > today) fail('PAYMENT_DATE_FUTURE');
  if (settings.finance.lockDate && body.date <= settings.finance.lockDate) fail('PERIOD_LOCKED');
  if (referenceRequired(body.mode) && !body.reference?.trim()) fail('REFERENCE_REQUIRED');
  const c = await t.get('customers', body.customerId);
  requireScope(p, 'customer', 'read', c);
  const tds = body.tdsAmount ?? 0;
  const total = body.amount + tds;
  // RULE-043 UTR uniqueness
  const ref = body.reference ? normaliseRef(body.reference) : null;
  if (ref) {
    const used = await t.get('utrIndex', ref);
    if (used) {
      if (!body.utrOverrideReason) throw new AppError('UTR_DUPLICATE', `UTR already used on ${used.receiptNo}.`, { usedBy: used.receiptNo });
      if (!hasPermission(p.role, 'payment:utr_override')) fail('FORBIDDEN', 'Only Admin or Accounts can override a duplicate UTR');
    }
  }
  const open = await openInvoices(t, c.id);
  const asOpen: OpenInvoice[] = open.map((i) => ({ id: i.id, number: String(i.number), date: String(i.date), dueDate: String(i.dueDate), balance: Number(i.balanceDue) }));
  let plan;
  if (body.allocation?.mode === 'manual') {
    const v = validateManual(asOpen, total, body.allocation.items ?? []);
    if ('error' in v) throw new AppError(v.error as 'ALLOCATION_EXCEEDS_AMOUNT', undefined, v.invoiceId ? { invoiceId: v.invoiceId } : undefined);
    plan = v;
  } else plan = autoAllocate(asOpen, total, body.allocation?.preferInvoiceId);
  const id = newId('pay_');
  const receiptNo = await nextDocNumber(t, 'receipt', body.date);
  const allocations = plan.allocations.map((a) => ({ invoiceId: a.invoiceId, number: String(open.find((i) => i.id === a.invoiceId)!.number), amount: a.amount }));
  let paidDaysSum = 0;
  let paidCount = 0;
  for (const a of allocations) {
    const inv = open.find((i) => i.id === a.invoiceId)!;
    const r = applyToInvoice(ctx, t, inv, a.amount, body.date);
    if (r.settledDays !== null) {
      paidDaysSum += r.settledDays;
      paidCount++;
    }
    t.set('allocations', `${id}_${a.invoiceId}`, { paymentId: id, invoiceId: a.invoiceId, customerId: c.id, amount: a.amount, active: true, createdAt: nowIso(ctx) });
  }
  t.create('payments', id, {
    receiptNo, customerId: c.id, customerName: c.displayName, ownerId: c.ownerId, recordedBy: p.userId, date: body.date, amount: body.amount, mode: body.mode, reference: body.reference ?? null, referenceNorm: ref,
    bankAccountId: body.bankAccountId ?? null, tdsAmount: tds, tdsSection: body.tdsSection ?? null, proofFileId: body.proofFileId ?? null, note: body.note ?? null, allocations, advance: plan.advance,
    status: 'active', reversal: null, utrOverride: ref && body.utrOverrideReason ? { by: p.userId, reason: body.utrOverrideReason } : null, pdf: { status: 'pending', attempts: 0 },
    searchTokens: searchTokens({ docNumbers: [receiptNo], codes: [ref] }), ...created(ctx, p),
  });
  if (ref && !(await t.get('utrIndex', ref))) t.create('utrIndex', ref, { paymentId: id, receiptNo });
  const allocated = allocations.reduce((s, a) => s + a.amount, 0);
  await applyCustomerDelta(t, c.id, { received: body.amount, tds, allocated, advance: plan.advance, paidDaysSum, paidCount });
  postLedger(ctx, t, { customerId: c.id, date: body.date, kind: 'payment', docId: id, docNumber: receiptNo, debit: 0, credit: body.amount });
  if (tds) postLedger(ctx, t, { customerId: c.id, date: body.date, kind: 'tds', docId: id, docNumber: `${receiptNo} TDS ${body.tdsSection ?? ''}`.trim(), debit: 0, credit: tds });
  addActivity(ctx, t, { recordType: 'customer', recordId: c.id, ownerId: String(c.ownerId), type: 'payment', note: `Payment ₹${(body.amount / 100).toFixed(2)} received (${body.mode.toUpperCase()}) — ${receiptNo}`, meta: { paymentId: id }, ...actor(p) });
  if (c.ownerId !== p.userId) notify(ctx, t, [String(c.ownerId)], 'N-009', `₹${(body.amount / 100).toLocaleString('en-IN')} received from ${c.displayName}`, `/sales/payments/${id}`, [`customer:${c.id}`]);
  if (ref && body.utrOverrideReason) audit(ctx, t, ri, { action: 'payment.utr_override', recordType: 'payment', recordId: id, meta: { reason: body.utrOverrideReason } });
  audit(ctx, t, ri, { action: 'payment.create', recordType: 'payment', recordId: id, after: { receiptNo, amount: body.amount, mode: body.mode, tds, allocations } });
  // invoices that reached zero: share links expire 90 days later (RULE-049)
  for (const a of allocations) {
    const inv = open.find((i) => i.id === a.invoiceId)!;
    if (Number(inv.balanceDue) - a.amount <= 0) {
      for (const l of (await t.query('shareLinks', { where: [['documentId', '==', inv.id], ['revokedAt', '==', null]], limit: 5 })).items) t.update('shareLinks', l.id, { expiresAt: new Date(ctx.clock.now().getTime() + 90 * 86_400_000).toISOString() });
    }
  }
  return { id, receiptNo, allocations, advance: plan.advance };
}

export function paymentsRoutes(ctx: Ctx): Router {
  const r = Router();
  r.use(['/payments', '/customers/:id/apply-advance'], authn);

  r.get('/payments', async (req, res) => {
    const p = P(req);
    const scope = scopeWhere(p, 'payment');
    if (!scope) fail('FORBIDDEN');
    const where: Where[] = [...scope!];
    if (str(req.query.customerId)) where.push(['customerId', '==', str(req.query.customerId)]);
    if (str(req.query.mode)) where.push(['mode', '==', str(req.query.mode)]);
    if (str(req.query.from)) where.push(['date', '>=', str(req.query.from)]);
    if (str(req.query.to)) where.push(['date', '<=', str(req.query.to)]);
    res.json(await ctx.db.query('payments', { where, orderBy: [['date', 'desc']], ...paging(req) }));
  });

  r.get('/payments/utr-check', async (req, res) => {
    const ref = str(req.query.ref);
    const used = ref ? await ctx.db.get('utrIndex', normaliseRef(ref)) : null;
    res.json(used ? { usedBy: used.receiptNo, paymentId: used.paymentId } : {});
  });

  // API-184 Preview
  r.post('/payments/preview', async (req, res) => {
    const p = P(req);
    const body = PaymentBody.partial({ date: true, mode: true }).parse(req.body);
    const c = await ctx.db.get('customers', body.customerId);
    requireScope(p, 'customer', 'read', c);
    const open = await ctx.db.tx(async (t) => openInvoices(t, c.id));
    const asOpen = open.map((i) => ({ id: i.id, number: String(i.number), date: String(i.date), dueDate: String(i.dueDate), balance: Number(i.balanceDue) }));
    const total = body.amount + (body.tdsAmount ?? 0);
    const plan = body.allocation?.mode === 'manual' ? validateManual(asOpen, total, body.allocation.items ?? []) : autoAllocate(asOpen, total, body.allocation?.preferInvoiceId);
    res.json({ open: asOpen, plan });
  });

  // API-181 Record (FR-070 – FR-072), Idempotency-Key (RULE-059)
  r.post('/payments', async (req, res) => {
    const p = P(req);
    const settings = await getSettings(ctx);
    if (!canRecord(p, settings.permissions.execPaymentsEnabled)) fail('FORBIDDEN');
    const body = PaymentBody.parse(req.body);
    await idempotent(ctx, req, res, `payment:${p.userId}`, false, async () => {
      const out = await ctx.db.tx(async (t) => recordPaymentTx(ctx, t, body, p, info(req)));
      void ctx.tasks.enqueue('pdf.render', { kind: 'receipt', id: out.id });
      for (const a of out.allocations) void ctx.tasks.enqueue('pdf.render', { kind: 'invoice', id: a.invoiceId });
      const pay = await ctx.db.get('payments', out.id);
      return { status: 201, body: pay };
    });
  });

  r.get('/payments/:id', async (req, res) => {
    const pay = await ctx.db.get('payments', String(req.params.id));
    requireScope(P(req), 'payment', 'read', pay);
    res.json(pay);
  });

  // API-183 Reverse (FR-073, RULE-046)
  r.post('/payments/:id/reverse', requirePerm('payment:reverse'), async (req, res) => {
    const p = P(req);
    const body = ReverseBody.parse(req.body);
    const id = String(req.params.id);
    const touched = await ctx.db.tx(async (t) => {
      const pay = await t.get('payments', id);
      requireScope(p, 'payment', 'read', pay);
      if (pay.status === 'reversed') fail('PAYMENT_ALREADY_REVERSED');
      const settings = await getSettings(ctx, t);
      if (settings.finance.lockDate && String(pay.date) <= settings.finance.lockDate) fail('PERIOD_LOCKED');
      const allocs = (await t.query('allocations', { where: [['paymentId', '==', id], ['active', '==', true]], limit: 500 })).items;
      const ids: string[] = [];
      let allocated = 0;
      for (const a of allocs) {
        const inv = await t.get('invoices', String(a.invoiceId));
        if (!inv) continue;
        const grand = Number((inv.totals as { grandTotal: number }).grandTotal);
        const paid = Number(inv.paid ?? 0) - Number(a.amount);
        const next = { grandTotal: grand, paid, credited: Number(inv.credited ?? 0) };
        t.update('invoices', inv.id, { paid, balanceDue: balanceDue(next), status: invoiceStatus(next), paidAt: null, pdf: { ...(inv.pdf as object), status: 'pending' }, version: Number(inv.version) + 1 });
        t.update('allocations', a.id, { active: false });
        allocated += Number(a.amount);
        ids.push(inv.id);
      }
      const tds = Number(pay.tdsAmount ?? 0);
      t.update('payments', id, { status: 'reversed', reversal: { by: p.userId, byName: p.name, at: nowIso(ctx), reason: body.reason }, pdf: { status: 'pending', attempts: 0 }, ...stamp(ctx, p, Number(pay.version)) });
      if (pay.referenceNorm) t.delete('utrIndex', String(pay.referenceNorm));
      await applyCustomerDelta(t, String(pay.customerId), { received: -Number(pay.amount), tds: -tds, allocated: -allocated, advance: -Number(pay.advance ?? 0) });
      const today = istDate(ctx.clock.now());
      postLedger(ctx, t, { customerId: String(pay.customerId), date: today, kind: 'reversal', docId: id, docNumber: `${pay.receiptNo} reversed`, debit: Number(pay.amount) + tds, credit: 0 });
      addActivity(ctx, t, { recordType: 'customer', recordId: String(pay.customerId), ownerId: String(pay.ownerId), type: 'payment', note: `Payment ${pay.receiptNo} reversed: ${body.reason}`, meta: { paymentId: id }, ...actor(p) });
      audit(ctx, t, info(req), { action: 'payment.reverse', recordType: 'payment', recordId: id, meta: { reason: body.reason, invoices: ids } });
      return ids;
    });
    void ctx.tasks.enqueue('pdf.render', { kind: 'receipt', id });
    for (const i of touched) void ctx.tasks.enqueue('pdf.render', { kind: 'invoice', id: i });
    res.json(await ctx.db.get('payments', id));
  });

  // API-185 Apply advance
  r.post('/customers/:id/apply-advance', async (req, res) => {
    const p = P(req);
    const body = ApplyAdvanceBody.parse(req.body);
    const customerId = String(req.params.id);
    await ctx.db.tx(async (t) => {
      const c = await t.get('customers', customerId);
      requireScope(p, 'customer', 'update', c);
      const adv = Number((c.totals as { advance?: number }).advance ?? 0);
      if (body.amount > adv) fail('ALLOCATION_EXCEEDS_AMOUNT');
      const inv = await t.get('invoices', body.invoiceId);
      if (!inv || inv.customerId !== customerId) fail('NOT_FOUND');
      if (body.amount > Number(inv!.balanceDue)) fail('ALLOCATION_EXCEEDS_BALANCE');
      applyToInvoice(ctx, t, inv!, body.amount, istDate(ctx.clock.now()));
      t.create('allocations', newId('adv_'), { paymentId: null, advance: true, invoiceId: inv!.id, customerId, amount: body.amount, active: true, createdAt: nowIso(ctx) });
      await applyCustomerDelta(t, customerId, { advance: -body.amount, allocated: body.amount });
      audit(ctx, t, info(req), { action: 'advance.apply', recordType: 'invoice', recordId: inv!.id, meta: { amount: body.amount } });
    });
    void ctx.tasks.enqueue('pdf.render', { kind: 'invoice', id: body.invoiceId });
    res.json({ ok: true });
  });

  return r;
}
