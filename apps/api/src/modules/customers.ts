import { Router } from 'express';
import { AddressBody, ContactBody, CustomerBody, hasPermission, scopeOf } from '@ss/contracts';
import { ageingBucket, buildStatement, istDate, normaliseContact, normaliseEmail, normalisePhone, queryToken, searchTokens, validateGstin, type AgeingBucket, type LedgerEntry } from '@ss/domain';
import type { Ctx, Principal } from '../context.js';
import type { Doc, Tx, Where } from '../db/types.js';
import { AppError, fail } from '../http/errors.js';
import { authn, info, P, paging, str } from '../http/pipeline.js';
import { audit, created, newId, nextCode, nowIso, requireCan, requireScope, scopeWhere, stamp, type ReqInfo } from '../shared/core.js';
import { createJob, finishJob } from './platform.js';
import { renderStatementHtml, storeExport } from './documents.js';

export interface CustomerInput {
  displayName: string;
  legalName?: string | null;
  type?: 'individual' | 'business' | 'government';
  groupId?: string | null;
  gstin?: string | null;
  pan?: string | null;
  ownerId: string;
  tags?: string[];
  creditDays?: number;
  leadIds?: string[];
  contact?: { name: string; phone?: string | null; email?: string | null; role?: string; consentBasis?: string } | null;
  billing?: { line1: string; line2?: string | null; city: string; stateCode: string; pincode?: string | null } | null;
}

/** received = cash received; allocated = cash + TDS applied to invoices; credited = credit notes applied to invoice balances; advance = on-account money. */
export const EMPTY_TOTALS = { invoiced: 0, received: 0, allocated: 0, credited: 0, outstanding: 0, advance: 0, tds: 0, activeOrders: 0, openQuotes: 0, paidDaysSum: 0, paidCount: 0 };

export function customerTokens(c: Record<string, unknown>, contacts: Record<string, unknown>[] = []) {
  return searchTokens({
    names: [c.displayName as string, c.legalName as string, ...contacts.map((x) => x.name as string)],
    phones: contacts.map((x) => x.phone as string), emails: contacts.map((x) => x.email as string), codes: [c.code as string, c.gstin as string],
  });
}

export async function createCustomerInTx(ctx: Ctx, t: Tx, input: CustomerInput, p: Principal | null, ri: ReqInfo): Promise<string> {
  if (input.gstin) {
    const err = validateGstin(input.gstin, input.billing?.stateCode || null);
    if (err) throw new AppError(err as 'GSTIN_INVALID');
  }
  const id = newId('c_');
  const code = await nextCode(t, 'customer', 'C-', 4);
  const contact = input.contact
    ? (() => {
        const ph = normalisePhone(input.contact!.phone);
        return { name: input.contact!.name, phone: ph?.e164 ?? null, phoneRaw: ph && !ph.valid ? ph.raw : null, phoneValid: !!ph?.valid, email: normaliseEmail(input.contact!.email) };
      })()
    : null;
  const doc: Record<string, unknown> = {
    code, displayName: input.displayName, legalName: input.legalName ?? null, type: input.type ?? 'business', groupId: input.groupId ?? null,
    gstin: input.gstin ?? null, pan: input.pan ?? null, ownerId: input.ownerId, tags: input.tags ?? [], creditDays: input.creditDays ?? null,
    totals: { ...EMPTY_TOTALS }, leadIds: input.leadIds ?? [], billingStateCode: input.billing?.stateCode || null, archived: false, driveFolderId: null, nextFollowUpAt: null,
    ...created(ctx, p),
  };
  doc.searchTokens = customerTokens(doc, contact ? [contact] : []);
  t.create('customers', id, doc);
  if (input.gstin && !(await t.get('gstinIndex', input.gstin))) t.create('gstinIndex', input.gstin, { customerId: id });
  if (contact) {
    const contactId = newId('ct_');
    t.create('contacts', contactId, { customerId: id, ...contact, role: input.contact!.role ?? 'decision_maker', isPrimary: true, consentBasis: input.contact!.consentBasis ?? 'person_initiated', consentAt: nowIso(ctx), ...created(ctx, p) });
    for (const k of [contact.phone && `p:${contact.phone}`, contact.email && `e:${contact.email}`].filter(Boolean) as string[]) t.set('contactKeys', k, { customerId: id, contactId, updatedAt: nowIso(ctx) });
  }
  if (input.billing?.line1) t.create('addresses', newId('ad_'), { customerId: id, type: 'billing', ...input.billing, isDefault: true });
  audit(ctx, t, ri, { action: 'customer.create', recordType: 'customer', recordId: id, after: doc });
  return id;
}

/** RULE-040: keep Customer 360 totals current in the same tx as each financial event. */
export async function applyCustomerDelta(t: Tx, customerId: string, delta: Partial<Record<keyof typeof EMPTY_TOTALS, number>>) {
  const c = await t.get('customers', customerId);
  if (!c) return;
  const totals = { ...EMPTY_TOTALS, ...(c.totals as object) } as typeof EMPTY_TOTALS;
  for (const [k, v] of Object.entries(delta) as [keyof typeof EMPTY_TOTALS, number][]) totals[k] = (totals[k] ?? 0) + (v ?? 0);
  totals.outstanding = Math.max(0, totals.invoiced - totals.allocated - totals.credited);
  t.update('customers', customerId, { totals });
}

let ledgerSeq = 0;
/** TBL-074 ledger entry (append-only); seq keeps same-millisecond entries in posting order. */
export function postLedger(ctx: Ctx, t: Tx, e: { customerId: string; date: string; kind: LedgerEntry['kind']; docId: string; docNumber: string; debit: number; credit: number }) {
  t.create('ledgerEntries', newId('le_'), { ...e, createdAt: nowIso(ctx), seq: ctx.clock.now().getTime() * 1000 + (ledgerSeq++ % 1000) });
}

async function overdueAndAgeing(ctx: Ctx, customerId: string, asOf: string) {
  const open = await ctx.db.all('invoices', { where: [['customerId', '==', customerId], ['status', 'in', ['issued', 'partly_paid']]] });
  const ageing: Record<AgeingBucket, number> = { not_due: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0 };
  let overdue = 0;
  for (const i of open) {
    if (i.type === 'proforma') continue;
    const b = ageingBucket(String(i.dueDate), asOf);
    ageing[b] += Number(i.balanceDue ?? 0);
    if (b !== 'not_due') overdue += Number(i.balanceDue ?? 0);
  }
  return { ageing, overdue, open };
}

export function customersRoutes(ctx: Ctx): Router {
  const r = Router();
  r.use('/customers', authn);

  r.get('/customers', async (req, res) => {
    const p = P(req);
    const scope = scopeWhere(p, 'customer');
    if (!scope) fail('FORBIDDEN');
    const where: Where[] = [...scope!, ['archived', '==', false]];
    const q = str(req.query.q);
    const tok = q ? queryToken(q) : null;
    if (tok) where.push(['searchTokens', 'array-contains', tok]);
    if (str(req.query.ownerId)) where.push(['ownerId', '==', str(req.query.ownerId)]);
    const page = await ctx.db.query('customers', { where, orderBy: [['displayName', 'asc']], ...paging(req) });
    const fin = scopeOf(p.role, 'finance', 'read') !== 'none';
    res.json({ items: page.items.map((c) => publicCustomer(c, fin)), nextCursor: page.nextCursor });
  });

  r.post('/customers', async (req, res) => {
    const p = P(req);
    requireCan(p, 'customer', 'create');
    const body = CustomerBody.parse(req.body);
    if (body.gstin && !body.confirmDuplicate && (await ctx.db.get('gstinIndex', body.gstin))) fail('POSSIBLE_DUPLICATE');
    if (body.contact) {
      const c = normaliseContact({ name: body.contact.name, phone: body.contact.phone, email: body.contact.email });
      if ('error' in c && body.contact.phone) throw new AppError(c.error as 'LEAD_CONTACT_REQUIRED');
    }
    const id = await ctx.db.tx(async (t) => createCustomerInTx(ctx, t, { ...body, ownerId: body.ownerId && p.role !== 'sales_exec' ? body.ownerId : p.userId, billing: body.billing ?? null, contact: body.contact ?? null }, p, info(req)));
    res.status(201).json(publicCustomer((await ctx.db.get('customers', id))!, true));
  });

  r.get('/customers/:id', async (req, res) => {
    const c = await ctx.db.get('customers', String(req.params.id));
    requireScope(P(req), 'customer', 'read', c);
    const [contacts, addresses] = await Promise.all([ctx.db.all('contacts', { where: [['customerId', '==', c.id]] }), ctx.db.all('addresses', { where: [['customerId', '==', c.id]] })]);
    res.setHeader('ETag', String(c.version ?? 1));
    res.json({ ...publicCustomer(c, scopeOf(P(req).role, 'finance', 'read') !== 'none'), contacts, addresses });
  });

  r.patch('/customers/:id', async (req, res) => {
    const p = P(req);
    const body = CustomerBody.partial().parse(req.body);
    const id = String(req.params.id);
    await ctx.db.tx(async (t) => {
      const c = await t.get('customers', id);
      requireScope(p, 'customer', 'update', c);
      const ifm = req.header('if-match');
      if (ifm !== undefined && Number(ifm) !== Number(c.version)) throw new AppError('VERSION_CONFLICT', `Changed by ${c.updatedByName ?? 'another user'} — reload`);
      const { contact: _c, billing: _b, confirmDuplicate: _d, ...fields } = body;
      if (fields.gstin) {
        const err = validateGstin(fields.gstin, (c.billingStateCode as string) || null);
        if (err) throw new AppError(err as 'GSTIN_INVALID');
      }
      const next = { ...c, ...fields };
      const contacts = (await t.query('contacts', { where: [['customerId', '==', id]], limit: 100 })).items;
      t.update('customers', id, { ...fields, searchTokens: customerTokens(next, contacts), ...stamp(ctx, p, Number(c.version)) });
      audit(ctx, t, info(req), { action: 'customer.update', recordType: 'customer', recordId: id, before: c, after: next });
    });
    if (body.displayName) void ctx.tasks.enqueue('drive.rename', { customerId: id });
    res.json(publicCustomer((await ctx.db.get('customers', id))!, true));
  });

  // API-193 Customer 360 (FR-075)
  r.get('/customers/:id/360', async (req, res) => {
    const p = P(req);
    const c = await ctx.db.get('customers', String(req.params.id));
    requireScope(p, 'customer', 'read', c);
    const fin = scopeOf(p.role, 'finance', 'read') !== 'none';
    const today = istDate(ctx.clock.now());
    const [activeOrders, openQuotes, next] = await Promise.all([
      ctx.db.count('salesOrders', { where: [['customerId', '==', c.id], ['status', 'in', ['confirmed', 'in_progress', 'on_hold']]] }),
      ctx.db.count('quotations', { where: [['customerId', '==', c.id], ['status', 'in', ['draft', 'pending_approval', 'approved', 'sent', 'viewed', 'changes_requested']]] }),
      ctx.db.query('followUps', { where: [['recordId', '==', c.id], ['status', '==', 'open']], orderBy: [['dueAt', 'asc']], limit: 1 }),
    ]);
    const tabs = ['overview', 'orders', 'quotes', 'activities', 'contacts', 'documents'];
    let kpis: Record<string, number> | null = null;
    let ageing: Record<string, number> | null = null;
    if (fin) {
      const t = { ...EMPTY_TOTALS, ...(c.totals as object) } as typeof EMPTY_TOTALS;
      const a = await overdueAndAgeing(ctx, c.id, today);
      ageing = a.ageing;
      kpis = {
        lifetimeValue: t.invoiced - t.credited, invoiced: t.invoiced, received: t.received, tds: t.tds, credited: t.credited, outstanding: a.open.filter((i) => i.type !== 'proforma').reduce((s, i) => s + Number(i.balanceDue ?? 0), 0),
        overdue: a.overdue, advance: t.advance, activeOrders, openQuotes, avgDaysToPay: t.paidCount ? Math.round(t.paidDaysSum / t.paidCount) : 0,
      };
      tabs.splice(3, 0, 'invoices', 'payments', 'ledger');
    } else kpis = { activeOrders, openQuotes };
    res.json({ customer: publicCustomer(c, fin), kpis, ageing, nextFollowUp: next.items[0] ?? null, tabs });
  });

  // API-194 / 195 Contacts and addresses
  r.post('/customers/:id/contacts', async (req, res) => {
    const p = P(req);
    const body = ContactBody.parse(req.body);
    const id = String(req.params.id);
    const contactId = newId('ct_');
    await ctx.db.tx(async (t) => {
      const c = await t.get('customers', id);
      requireScope(p, 'customer', 'update', c);
      const ph = normalisePhone(body.phone);
      const email = normaliseEmail(body.email);
      const contact = { customerId: id, name: body.name, role: body.role, phone: ph?.e164 ?? null, phoneRaw: ph && !ph.valid ? ph.raw : null, phoneValid: !!ph?.valid, email, isPrimary: !!body.isPrimary, consentBasis: 'person_initiated', consentAt: nowIso(ctx), ...created(ctx, p) };
      t.create('contacts', contactId, contact);
      for (const k of [contact.phone && `p:${contact.phone}`, email && `e:${email}`].filter(Boolean) as string[]) if (!(await t.get('contactKeys', k))) t.set('contactKeys', k, { customerId: id, contactId, updatedAt: nowIso(ctx) });
      const contacts = [...(await t.query('contacts', { where: [['customerId', '==', id]], limit: 100 })).items, contact];
      t.update('customers', id, { searchTokens: customerTokens(c, contacts) });
      audit(ctx, t, info(req), { action: 'contact.create', recordType: 'customer', recordId: id, after: contact });
    });
    res.status(201).json(await ctx.db.get('contacts', contactId));
  });
  r.patch('/customers/:id/contacts/:cid', async (req, res) => {
    const p = P(req);
    const body = ContactBody.partial().parse(req.body);
    const cid = String(req.params.cid);
    await ctx.db.tx(async (t) => {
      const c = await t.get('customers', String(req.params.id));
      requireScope(p, 'customer', 'update', c);
      const cur = await t.get('contacts', cid);
      if (!cur || cur.customerId !== c.id) fail('NOT_FOUND');
      const ph = body.phone !== undefined ? normalisePhone(body.phone) : undefined;
      t.update('contacts', cid, { ...body, ...(ph !== undefined ? { phone: ph?.e164 ?? null, phoneValid: !!ph?.valid } : {}), ...(body.email !== undefined ? { email: normaliseEmail(body.email) } : {}) });
      audit(ctx, t, info(req), { action: 'contact.update', recordType: 'customer', recordId: c.id, before: cur, after: { ...cur, ...body } });
    });
    res.json(await ctx.db.get('contacts', cid));
  });
  r.post('/customers/:id/addresses', async (req, res) => {
    const p = P(req);
    const body = AddressBody.parse(req.body);
    const id = String(req.params.id);
    const aid = newId('ad_');
    await ctx.db.tx(async (t) => {
      const c = await t.get('customers', id);
      requireScope(p, 'customer', 'update', c);
      if (body.type === 'billing' && c.gstin && String(c.gstin).slice(0, 2) !== body.stateCode) fail('GSTIN_STATE_MISMATCH');
      if (body.isDefault) for (const a of (await t.query('addresses', { where: [['customerId', '==', id], ['type', '==', body.type]], limit: 50 })).items) t.update('addresses', a.id, { isDefault: false });
      t.create('addresses', aid, { customerId: id, ...body });
      if (body.type === 'billing' && (body.isDefault || !c.billingStateCode)) t.update('customers', id, { billingStateCode: body.stateCode });
      audit(ctx, t, info(req), { action: 'address.create', recordType: 'customer', recordId: id, after: body });
    });
    res.status(201).json(await ctx.db.get('addresses', aid));
  });

  // API-196 Statement (FR-076)
  r.get('/customers/:id/statement', async (req, res) => {
    const p = P(req);
    if (!hasPermission(p.role, 'report:finance') || scopeOf(p.role, 'finance', 'read') === 'none') fail('FORBIDDEN');
    const c = await ctx.db.get('customers', String(req.params.id));
    requireScope(p, 'customer', 'read', c);
    const today = istDate(ctx.clock.now());
    const from = str(req.query.from) ?? `${today.slice(0, 4)}-04-01`;
    const to = str(req.query.to) ?? today;
    const st = await statementFor(ctx, c.id, from, to);
    const format = str(req.query.format) ?? 'json';
    if (format === 'json') return void res.json({ customer: publicCustomer(c, true), ...st });
    const jobId = await createJob(ctx, p.userId, 'statement.export');
    res.status(202).json({ jobId });
    void (async () => {
      try {
        const file = format === 'xlsx'
          ? await storeExport(ctx, `statement-${c.code}.xlsx`, ['date', 'kind', 'docNumber', 'debit', 'credit', 'balance'], st.rows.map((x) => ({ ...x, debit: x.debit / 100, credit: x.credit / 100, balance: x.balance / 100 })))
          : await storeExport(ctx, `statement-${c.code}.html`, null, [], await renderStatementHtml(ctx, c, st));
        await finishJob(ctx, jobId, file);
      } catch (e) {
        await finishJob(ctx, jobId, null, (e as Error).message);
      }
    })();
  });

  // API-197 Tabs
  r.get('/customers/:id/:tab', async (req, res) => {
    const p = P(req);
    const tab = String(req.params.tab);
    // FR-075 AC3: finance tabs need finance read access (Project Manager excluded)
    const map: Record<string, [string, Parameters<typeof scopeOf>[1]]> = { invoices: ['invoices', 'finance'], payments: ['payments', 'finance'], orders: ['salesOrders', 'order'], quotes: ['quotations', 'quote'], ledger: ['ledgerEntries', 'finance'] };
    const m = map[tab];
    if (!m) fail('NOT_FOUND');
    const c = await ctx.db.get('customers', String(req.params.id));
    requireScope(p, 'customer', 'read', c);
    if (scopeOf(p.role, m![1], 'read') === 'none') fail('FORBIDDEN');
    const order: [string, 'asc' | 'desc'] = tab === 'ledger' ? ['date', 'asc'] : ['createdAt', 'desc'];
    const page = await ctx.db.query(m![0], { where: [['customerId', '==', c.id]], orderBy: [order], ...paging(req) });
    const today = istDate(ctx.clock.now());
    res.json({ items: tab === 'invoices' ? page.items.map((i) => ({ ...i, ageing: i.dueDate ? ageingBucket(String(i.dueDate), today) : null })) : page.items, nextCursor: page.nextCursor });
  });

  return r;
}

export async function statementFor(ctx: Ctx, customerId: string, from: string, to: string) {
  const entries = (await ctx.db.all('ledgerEntries', { where: [['customerId', '==', customerId]] })).map((e) => ({ date: String(e.date), seq: Number(e.seq ?? 0), kind: e.kind as LedgerEntry['kind'], docNumber: String(e.docNumber), debit: Number(e.debit), credit: Number(e.credit) }));
  return buildStatement(entries, from, to);
}

export function publicCustomer(c: Doc, finance: boolean) {
  const { searchTokens: _s, totals, ...rest } = c;
  return finance ? { ...rest, totals } : rest;
}
