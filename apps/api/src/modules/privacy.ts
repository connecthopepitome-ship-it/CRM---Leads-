import { Router } from 'express';
import { PrivacyActBody, PrivacyFindBody } from '@ss/contracts';
import { erasurePlan, isJunkPurgeDue, istDate, maskValue, normaliseEmail, normalisePhone } from '@ss/domain';
import type { Ctx } from '../context.js';
import type { Doc } from '../db/types.js';
import { fail } from '../http/errors.js';
import { authn, info, P, requirePerm } from '../http/pipeline.js';
import { audit, newId, nowIso, sha256, token, type ReqInfo } from '../shared/core.js';
import { createJob, finishJob } from './platform.js';
import { storeExport } from './documents.js';

interface Found {
  keys: string[];
  leads: Doc[];
  contacts: Doc[];
  activities: Doc[];
  quotes: Doc[];
  orders: Doc[];
  financial: number;
  files: Doc[];
}

async function findPerson(ctx: Ctx, keys: string[]): Promise<Found> {
  const phones = keys.filter((k) => k.startsWith('p:')).map((k) => k.slice(2));
  const emails = keys.filter((k) => k.startsWith('e:')).map((k) => k.slice(2));
  const leads = [
    ...(phones.length ? await ctx.db.all('leads', { where: [['phone', 'in', phones]] }) : []),
    ...(emails.length ? await ctx.db.all('leads', { where: [['email', 'in', emails]] }) : []),
  ].filter((v, i, a) => a.findIndex((x) => x.id === v.id) === i);
  const contacts = [
    ...(phones.length ? await ctx.db.all('contacts', { where: [['phone', 'in', phones]] }) : []),
    ...(emails.length ? await ctx.db.all('contacts', { where: [['email', 'in', emails]] }) : []),
  ].filter((v, i, a) => a.findIndex((x) => x.id === v.id) === i);
  const leadIds = leads.map((l) => l.id);
  const customerIds = [...new Set(contacts.map((c) => String(c.customerId)))];
  const activities = leadIds.length ? (await Promise.all(leadIds.map((id) => ctx.db.all('activities', { where: [['recordId', '==', id]] })))).flat() : [];
  const quotes = leadIds.length ? (await Promise.all(leadIds.map((id) => ctx.db.all('quotations', { where: [['leadId', '==', id]] })))).flat() : [];
  let financial = 0;
  const orders: Doc[] = [];
  for (const cid of customerIds) {
    financial += (await ctx.db.all('invoices', { where: [['customerId', '==', cid]] })).filter((i) => i.status !== 'draft').length;
    financial += await ctx.db.count('payments', { where: [['customerId', '==', cid]] });
    orders.push(...(await ctx.db.all('salesOrders', { where: [['customerId', '==', cid]] })));
    quotes.push(...(await ctx.db.all('quotations', { where: [['customerId', '==', cid]] })).filter((q) => !quotes.some((x) => x.id === q.id)));
  }
  const files = leadIds.length ? (await Promise.all(leadIds.map((id) => ctx.db.all('files', { where: [['recordId', '==', id]] })))).flat() : [];
  return { keys, leads, contacts, activities, quotes, orders, financial, files };
}

export function privacyRoutes(ctx: Ctx): Router {
  const r = Router();
  r.use('/admin/privacy', authn, requirePerm('privacy:execute'));

  // API-240 Find (body only — no PII in URLs)
  r.post('/admin/privacy/find', async (req, res) => {
    const body = PrivacyFindBody.parse(req.body);
    const keys: string[] = [];
    const ph = normalisePhone(body.phone);
    if (ph?.valid && ph.e164) keys.push(`p:${ph.e164}`);
    const em = normaliseEmail(body.email);
    if (em) keys.push(`e:${em}`);
    const f = await findPerson(ctx, keys);
    if (!f.leads.length && !f.contacts.length) fail('NOTHING_FOUND');
    const personKey = `pk_${token(16)}`;
    await ctx.db.tx(async (t) => {
      t.create('personKeys', personKey, { keys, createdBy: P(req).userId, expireAt: new Date(ctx.clock.now().getTime() + 30 * 60_000).toISOString() });
      audit(ctx, t, info(req), { action: 'privacy.find', meta: { keys: keys.map((k) => (k.startsWith('p:') ? maskValue('phone', k.slice(2)) : maskValue('email', k.slice(2)))) } });
    });
    const plan = erasurePlan({ leadIds: f.leads.map((l) => l.id), contactRefs: f.contacts.map((c) => ({ customerId: String(c.customerId), contactId: c.id })), quoteIds: f.quotes.map((q) => q.id), orderIds: f.orders.map((o) => o.id), financialDocCount: f.financial });
    res.json({
      personKey, counts: { leads: f.leads.length, contacts: f.contacts.length, activities: f.activities.length, quotes: f.quotes.length, orders: f.orders.length, financialDocuments: f.financial, files: f.files.length },
      records: [...f.leads.map((l) => ({ type: 'lead', id: l.id, name: l.name, stage: l.stage })), ...f.contacts.map((c) => ({ type: 'contact', id: c.id, name: c.name, customerId: c.customerId }))], plan,
    });
  });

  async function keysFor(personKey: string) {
    const k = await ctx.db.get('personKeys', personKey);
    if (!k || new Date(String(k.expireAt)) < ctx.clock.now()) fail('PERSON_KEY_EXPIRED');
    return k!.keys as string[];
  }

  // API-241 Export (FR-087)
  r.post('/admin/privacy/export', async (req, res) => {
    const body = PrivacyActBody.parse(req.body);
    const keys = await keysFor(body.personKey);
    const p = P(req);
    const jobId = await createJob(ctx, p.userId, 'privacy.export');
    const reqId = newId('pr_');
    await ctx.db.tx(async (t) => {
      t.create('privacyRequests', reqId, { type: 'export', keysHash: keys.map(sha256), requestedBy: p.userId, at: nowIso(ctx), status: 'queued', jobId });
      audit(ctx, t, info(req), { action: 'privacy.export', meta: { requestId: reqId } });
    });
    res.status(202).json({ jobId });
    void (async () => {
      try {
        const f = await findPerson(ctx, keys);
        const rows = [
          ...f.leads.map((l) => ({ type: 'lead', id: l.id, name: l.name, phone: l.phone, email: l.email, company: l.company, city: l.city, source: l.sourceId, consent: l.consentBasis, createdAt: l.createdAt })),
          ...f.contacts.map((c) => ({ type: 'contact', id: c.id, name: c.name, phone: c.phone, email: c.email, company: c.customerId, city: '', source: '', consent: c.consentBasis, createdAt: c.createdAt })),
          ...f.activities.map((a) => ({ type: `activity:${a.type}`, id: a.id, name: a.note, phone: '', email: '', company: '', city: '', source: '', consent: '', createdAt: a.occurredAt })),
          ...f.files.map((x) => ({ type: 'file', id: x.id, name: x.name, phone: '', email: '', company: '', city: '', source: '', consent: '', createdAt: x.createdAt })),
        ];
        const file = await storeExport(ctx, 'personal-data-export.xlsx', ['type', 'id', 'name', 'phone', 'email', 'company', 'city', 'source', 'consent', 'createdAt'], rows);
        await ctx.db.tx(async (t) => t.update('privacyRequests', reqId, { status: 'done', completedAt: nowIso(ctx) }));
        await finishJob(ctx, jobId, file);
      } catch (e) {
        await finishJob(ctx, jobId, null, (e as Error).message);
      }
    })();
  });

  // API-242 Erase (FR-088)
  r.post('/admin/privacy/erase', async (req, res) => {
    const body = PrivacyActBody.parse(req.body);
    if (body.confirm !== 'ERASE') fail('CONFIRMATION_REQUIRED');
    const keys = await keysFor(body.personKey);
    const p = P(req);
    const jobId = await createJob(ctx, p.userId, 'privacy.erase');
    res.status(202).json({ jobId });
    try {
      const counts = await erasePerson(ctx, keys, info(req));
      await finishJob(ctx, jobId, counts);
    } catch (e) {
      await finishJob(ctx, jobId, null, (e as Error).message);
    }
  });

  // API-243 History
  r.get('/admin/privacy/requests', async (_req, res) => {
    res.json({ items: (await ctx.db.all('privacyRequests', { orderBy: [['at', 'desc']] })).slice(0, 100) });
  });

  return r;
}

/** RULE-054 erasure; writes the erasure ledger (CR-001) and a non-personal tombstone. */
export async function erasePerson(ctx: Ctx, keys: string[], ri: ReqInfo) {
  const f = await findPerson(ctx, keys);
  const plan = erasurePlan({ leadIds: f.leads.map((l) => l.id), contactRefs: f.contacts.map((c) => ({ customerId: String(c.customerId), contactId: c.id })), quoteIds: f.quotes.map((q) => q.id), orderIds: f.orders.map((o) => o.id), financialDocCount: f.financial });
  for (const file of f.files) if (file.storage === 'drive') await ctx.google.deleteFile(String(file.ref)).catch(() => undefined);
  const reqId = newId('pr_');
  await ctx.db.tx(async (t) => {
    for (const id of plan.deleteLeads) {
      t.delete('leads', id);
      t.set('tombstones', `lead-${id}`, { recordType: 'lead', id, reason: 'erased_on_request', at: nowIso(ctx) });
    }
    for (const a of f.activities) t.delete('activities', a.id);
    for (const x of f.files) {
      t.delete('files', x.id);
      if (x.storage === 'blob') t.delete('blobs', String(x.ref));
    }
    for (const id of plan.deleteQuotes) t.delete('quotations', id);
    for (const id of plan.deleteOrders) t.delete('salesOrders', id);
    for (const c of plan.anonymiseContacts) t.update('contacts', c.contactId, { name: 'Erased contact', phone: null, phoneRaw: null, email: null, erasedAt: nowIso(ctx) });
    for (const id of plan.anonymiseQuotes) t.update('quotations', id, { notes: null, response: null, partyName: 'Erased' });
    for (const id of plan.anonymiseOrders) t.update('salesOrders', id, { notes: null, customerPoRef: null });
    for (const k of keys) t.delete('contactKeys', k);
    for (const n of (await t.query('notifications', { where: [['refs', 'array-contains-any', f.leads.map((l) => `lead:${l.id}`).slice(0, 10).concat('x')]], limit: 500 })).items) t.delete('notifications', n.id);
    t.create('erasureLedger', newId('el_'), { keysHash: keys.map(sha256), leadIds: plan.deleteLeads, contactIds: plan.anonymiseContacts.map((c) => c.contactId), mode: plan.mode, at: nowIso(ctx) });
    t.create('privacyRequests', reqId, { type: 'erase', keysHash: keys.map(sha256), requestedBy: ri.principal?.userId ?? 'system', at: nowIso(ctx), status: 'done', counts: { leads: plan.deleteLeads.length, contacts: plan.anonymiseContacts.length, files: f.files.length, mode: plan.mode } });
    audit(ctx, t, ri, { action: 'privacy.erase', meta: { requestId: reqId, mode: plan.mode, leads: plan.deleteLeads.length, contacts: plan.anonymiseContacts.length, files: f.files.length } });
  });
  return { mode: plan.mode, leads: plan.deleteLeads.length, contacts: plan.anonymiseContacts.length, files: f.files.length };
}

/** retention.purge daily (FR-090, RULE-052/053). */
export async function retentionPurgeJob(ctx: Ctx) {
  const today = istDate(ctx.clock.now());
  const junk = await ctx.db.all('leads', { where: [['stage', '==', 'junk']] });
  let n = 0;
  for (const l of junk) {
    if (!l.junkAt || !isJunkPurgeDue(String(l.junkAt), today, ctx.cfg.junkRetentionMonths)) continue;
    if (await ctx.db.count('quotations', { where: [['leadId', '==', l.id], ['number', '!=', null]] })) continue; // never purge leads with sent quotations (RULE-053)
    const acts = await ctx.db.all('activities', { where: [['recordId', '==', l.id]] });
    const files = await ctx.db.all('files', { where: [['recordId', '==', l.id]] });
    for (const f of files) if (f.storage === 'drive') await ctx.google.deleteFile(String(f.ref)).catch(() => undefined);
    await ctx.db.tx(async (t) => {
      const cur = await t.get('leads', l.id);
      if (!cur || cur.stage !== 'junk') return;
      t.delete('leads', l.id);
      for (const a of acts) t.delete('activities', a.id);
      for (const f of files) t.delete('files', f.id);
      for (const k of [l.phone && `p:${l.phone}`, l.email && `e:${l.email}`].filter(Boolean) as string[]) {
        const ck = await t.get('contactKeys', k);
        if (ck?.leadId === l.id) t.delete('contactKeys', k);
      }
      t.set('tombstones', `lead-${l.id}`, { recordType: 'lead', id: l.id, reason: 'retention_purge', at: nowIso(ctx) });
    });
    n++;
  }
  if (n) await ctx.db.tx(async (t) => audit(ctx, t, { principal: null }, { action: 'retention.purge', meta: { count: n } }));
  return n;
}

/** Runbook step after a backup restore: re-apply erasures (CR-001). */
export async function reapplyErasureLedger(ctx: Ctx) {
  const ledger = await ctx.db.all('erasureLedger');
  let n = 0;
  await ctx.db.tx(async (t) => {
    for (const e of ledger) {
      for (const id of (e.leadIds as string[]) ?? []) if (await t.get('leads', id)) {
        t.delete('leads', id);
        n++;
      }
      for (const id of (e.contactIds as string[]) ?? []) {
        const c = await t.get('contacts', id);
        if (c && !c.erasedAt) {
          t.update('contacts', id, { name: 'Erased contact', phone: null, email: null, erasedAt: nowIso(ctx) });
          n++;
        }
      }
    }
  });
  return n;
}
